import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DEFAULT_CHAT_ROOM_ID } from '@jet/constants/default-chat-room-id.constant';
import { MessageWithProfile } from '@jet/interfaces/message.interface';
import { AlertService } from '@jet/services/alert/alert.service';
import { ChatService } from '@jet/services/chat/chat.service';
import { LoggerService } from '@jet/services/logger/logger.service';
import { ProgressBarService } from '@jet/services/progress-bar/progress-bar.service';
import { PushService } from '@jet/services/push/push.service';
import { UserService } from '@jet/services/user/user.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { distinctUntilChanged, finalize, from, switchMap } from 'rxjs';
import { PageComponent } from '../page/page.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoModule,
    PageComponent,
  ],
  providers: [ChatService],
  selector: 'jet-chat-page',
  styleUrl: './chat-page.component.scss',
  templateUrl: './chat-page.component.html',
})
export class ChatPageComponent implements OnDestroy {
  readonly #alertService = inject(AlertService);
  readonly #chatService = inject(ChatService);
  readonly #formBuilder = inject(FormBuilder);
  readonly #loggerService = inject(LoggerService);
  readonly #progressBarService = inject(ProgressBarService);
  readonly #pushService = inject(PushService);
  readonly #translocoService = inject(TranslocoService);
  readonly #userService = inject(UserService);

  readonly #effectiveRoomId = computed((): string => {
    const roomId = this.roomId();

    if (roomId && roomId !== 'undefined') {
      return roomId;
    }

    return DEFAULT_CHAT_ROOM_ID;
  });

  /** Route param `roomId`; il default del router non si applica se il param manca. */
  public readonly roomId = input<string | undefined>();

  protected readonly isLoading: WritableSignal<boolean> = signal(false);
  protected readonly messageFormGroup: FormGroup<{ body: FormControl<null | string> }>;

  protected readonly isRealtimeConnected = this.#chatService.isRealtimeConnected;
  protected readonly isPushSubscribed = this.#pushService.isSubscribed;
  protected readonly messages = this.#chatService.messages;
  protected readonly pushPermission = this.#pushService.permission;

  public constructor() {
    this.messageFormGroup = this.#formBuilder.group({
      body: this.#formBuilder.control<null | string>(null, [
        Validators.maxLength(4000),
        Validators.minLength(1),
        Validators.required,
      ]),
    });

    toObservable(this.#effectiveRoomId)
      .pipe(
        distinctUntilChanged(),
        switchMap((roomId) => {
          this.#progressBarService.showQueryProgressBar();

          return from(this.#chatService.connectRoom(roomId)).pipe(
            finalize(() => {
              this.#progressBarService.hideProgressBar();
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        error: (exception: unknown) => {
          if (exception instanceof Error) {
            this.#loggerService.logError(exception);
            this.#alertService.showErrorAlert(exception.message);
          } else {
            this.#loggerService.logException(exception);
          }
        },
      });

    this.#loggerService.logComponentInitialization('ChatPageComponent');
  }

  public ngOnDestroy(): void {
    this.#chatService.disconnectRoom();
  }

  protected currentUserId(): null | string {
    return this.#userService.user()?.id ?? null;
  }

  protected displayName(message: MessageWithProfile): string {
    const profile = message.profiles;

    if (profile?.full_name) {
      return profile.full_name;
    }

    if (profile?.username) {
      return profile.username;
    }

    return this.#translocoService.translate('jet-chat-page.unknown-user');
  }

  protected isPushEnabled(): boolean {
    return this.#pushService.isEnabled;
  }

  protected async enablePushNotifications(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    try {
      await this.#pushService.enableNotifications();
      this.#alertService.showAlert(this.#translocoService.translate('jet-chat-page.push-enabled'));
    } catch (exception: unknown) {
      if (exception instanceof Error) {
        this.#loggerService.logError(exception);
        this.#alertService.showErrorAlert(exception.message);
      } else {
        this.#loggerService.logException(exception);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async sendMessage(): Promise<void> {
    if (this.messageFormGroup.invalid || this.isLoading()) {
      return;
    }

    const body = this.messageFormGroup.value.body?.trim();

    if (!body) {
      return;
    }

    this.isLoading.set(true);
    this.messageFormGroup.disable();
    this.#progressBarService.showQueryProgressBar();

    try {
      await this.#chatService.sendMessage(this.#effectiveRoomId(), body);
      this.messageFormGroup.reset();
      this.messageFormGroup.markAsPristine();
    } catch (exception: unknown) {
      if (exception instanceof Error) {
        this.#loggerService.logError(exception);
        this.#alertService.showErrorAlert(exception.message);
      } else {
        this.#loggerService.logException(exception);
      }
    } finally {
      this.isLoading.set(false);
      this.messageFormGroup.enable();
      this.#progressBarService.hideProgressBar();
    }
  }

  protected async unsubscribePush(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    try {
      await this.#pushService.unsubscribe();
      this.#alertService.showAlert(this.#translocoService.translate('jet-chat-page.push-disabled'));
    } catch (exception: unknown) {
      if (exception instanceof Error) {
        this.#loggerService.logError(exception);
        this.#alertService.showErrorAlert(exception.message);
      } else {
        this.#loggerService.logException(exception);
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
