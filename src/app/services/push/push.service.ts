import { DestroyRef, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { SupabaseTable } from '@jet/enums/supabase-table.enum';
import { SUPABASE_CLIENT } from '@jet/injection-tokens/supabase-client.injection-token';
import { VAPID_PUBLIC_KEY } from '@jet/injection-tokens/vapid-public-key.injection-token';
import { LoggerService } from '@jet/services/logger/logger.service';
import { firstValueFrom } from 'rxjs';

type NotificationPermissionState = 'unsupported' | NotificationPermission;

@Injectable({ providedIn: 'root' })
export class PushService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #router = inject(Router);
  readonly #supabaseClient = inject(SUPABASE_CLIENT);
  readonly #swPush = inject(SwPush);
  readonly #vapidPublicKey = inject(VAPID_PUBLIC_KEY);
  readonly #loggerService = inject(LoggerService);

  readonly #isSubscribed: WritableSignal<boolean> = signal(false);
  readonly #lastForegroundPayload: WritableSignal<null | object> = signal(null);
  readonly #permission: WritableSignal<NotificationPermissionState> = signal(
    this.#getInitialPermission(),
  );

  public constructor() {
    if (this.#swPush.isEnabled) {
      this.#swPush.subscription.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((sub) => {
        this.#isSubscribed.set(sub !== null);
      });

      this.#swPush.notificationClicks
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe(({ notification }) => {
          const roomId: unknown = notification.data?.['roomId'];

          if (typeof roomId === 'string' && roomId.length > 0) {
            void this.#router.navigate(['/chat', roomId]);
          }
        });

      this.#swPush.messages.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((message) => {
        this.#lastForegroundPayload.set(message);
        this.#loggerService.log('SwPush foreground message', message);
      });
    }

    this.#loggerService.logServiceInitialization('PushService');
  }

  public get isEnabled(): boolean {
    return this.#swPush.isEnabled;
  }

  public get isSubscribed(): Signal<boolean> {
    return this.#isSubscribed.asReadonly();
  }

  public get lastForegroundPayload(): Signal<null | object> {
    return this.#lastForegroundPayload.asReadonly();
  }

  public get permission(): Signal<NotificationPermissionState> {
    return this.#permission.asReadonly();
  }

  public hasVapidPublicKey(): boolean {
    return this.#vapidPublicKey.length > 0;
  }

  public async enableNotifications(): Promise<void> {
    if (!this.#swPush.isEnabled) {
      throw new Error(
        'Service worker is disabled. Build for production or set NG_APP_IS_SERVICE_WORKER_ENABLED=true.',
      );
    }

    if (!this.hasVapidPublicKey()) {
      throw new Error('NG_APP_VAPID_PUBLIC_KEY is not configured.');
    }

    const permission = await Notification.requestPermission();
    this.#permission.set(permission);

    if (permission !== 'granted') {
      throw new Error(`Notification permission: ${permission}`);
    }

    const subscription = await this.#swPush.requestSubscription({
      serverPublicKey: this.#vapidPublicKey,
    });

    await this.#saveSubscription(subscription);
  }

  public async unsubscribe(): Promise<void> {
    if (!this.#swPush.isEnabled) {
      return;
    }

    const subscription = await firstValueFrom(this.#swPush.subscription);

    if (subscription) {
      await this.#deleteSubscription(subscription.endpoint);
      await this.#swPush.unsubscribe();
    }

    this.#isSubscribed.set(false);
  }

  async #deleteSubscription(endpoint: string): Promise<void> {
    const userId = await this.#getAuthenticatedUserId();

    if (!userId) {
      return;
    }

    await this.#supabaseClient
      .from(SupabaseTable.PushSubscriptions)
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .throwOnError();
  }

  #getInitialPermission(): NotificationPermissionState {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }

    return Notification.permission;
  }

  async #getAuthenticatedUserId(): Promise<null | string> {
    const { data, error } = await this.#supabaseClient.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user?.id ?? null;
  }

  async #saveSubscription(subscription: PushSubscription): Promise<void> {
    const userId = await this.#getAuthenticatedUserId();

    if (!userId) {
      throw new Error('Sign in to save push subscription.');
    }

    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');

    if (!p256dh || !auth) {
      throw new Error('Push subscription keys are missing.');
    }

    await this.#supabaseClient
      .from(SupabaseTable.PushSubscriptions)
      .upsert(
        {
          auth: this.#arrayBufferToBase64Url(auth),
          endpoint: subscription.endpoint,
          p256dh: this.#arrayBufferToBase64Url(p256dh),
          updated_at: new Date().toISOString(),
          user_id: userId,
        },
        { onConflict: 'user_id,endpoint' },
      )
      .throwOnError();
  }

  #arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
}
