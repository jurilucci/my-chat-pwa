import { DestroyRef, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { SupabaseTable } from '@jet/enums/supabase-table.enum';
import { SUPABASE_CLIENT } from '@jet/injection-tokens/supabase-client.injection-token';
import { Message, MessageWithProfile } from '@jet/interfaces/message.interface';
import { RealtimeChannel } from '@supabase/supabase-js';
import { LoggerService } from '../logger/logger.service';
import { UserService } from '../user/user.service';

@Injectable()
export class ChatService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #supabaseClient = inject(SUPABASE_CLIENT);
  readonly #loggerService = inject(LoggerService);
  readonly #userService = inject(UserService);

  readonly #isRealtimeConnected: WritableSignal<boolean> = signal(false);
  readonly #messages: WritableSignal<MessageWithProfile[]> = signal([]);

  #channel: null | RealtimeChannel = null;
  #roomId: null | string = null;

  public constructor() {
    this.#loggerService.logServiceInitialization('ChatService');
  }

  public get isRealtimeConnected(): Signal<boolean> {
    return this.#isRealtimeConnected.asReadonly();
  }

  public get messages(): Signal<MessageWithProfile[]> {
    return this.#messages.asReadonly();
  }

  public disconnectRoom(): void {
    if (this.#channel) {
      void this.#supabaseClient.removeChannel(this.#channel);
      this.#channel = null;
    }

    this.#roomId = null;
    this.#isRealtimeConnected.set(false);
    this.#messages.set([]);
  }

  public async connectRoom(roomId: string): Promise<void> {
    if (this.#roomId === roomId && this.#channel) {
      return;
    }

    this.disconnectRoom();
    this.#roomId = roomId;

    await this.#loadMessages(roomId);
    this.#subscribeToRoom(roomId);
  }

  public async sendMessage(roomId: string, body: string): Promise<Message> {
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      throw new Error('Message body is empty.');
    }

    const userId = this.#userService.user()?.id;

    if (!userId) {
      throw new Error('Sign in to send messages.');
    }

    const { data } = await this.#supabaseClient
      .from(SupabaseTable.Messages)
      .insert({ body: trimmedBody, room_id: roomId, user_id: userId })
      .select()
      .single()
      .throwOnError();

    return data;
  }

  async #loadMessages(roomId: string): Promise<void> {
    const { data } = await this.#supabaseClient
      .from(SupabaseTable.Messages)
      .select(
        'id, room_id, user_id, body, created_at, profiles!messages_user_id_profiles_fkey ( username, full_name )',
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100)
      .throwOnError();

    this.#messages.set(data.map((row) => this.#normalizeMessage(row)));
  }

  #subscribeToRoom(roomId: string): void {
    this.#channel = this.#supabaseClient
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `room_id=eq.${roomId}`,
          schema: 'public',
          table: SupabaseTable.Messages,
        },
        (payload) => {
          void this.#handleInsert(payload.new as Message);
        },
      )
      .subscribe((status) => {
        this.#isRealtimeConnected.set(status === 'SUBSCRIBED');
      });

    this.#destroyRef.onDestroy(() => {
      this.disconnectRoom();
    });
  }

  async #handleInsert(message: Message): Promise<void> {
    if (this.#messages().some((existing) => existing.id === message.id)) {
      return;
    }

    const { data } = await this.#supabaseClient
      .from(SupabaseTable.Messages)
      .select(
        'id, room_id, user_id, body, created_at, profiles!messages_user_id_profiles_fkey ( username, full_name )',
      )
      .eq('id', message.id)
      .single()
      .throwOnError();

    this.#messages.update((current) => [...current, this.#normalizeMessage(data)]);
  }

  #normalizeMessage(row: unknown): MessageWithProfile {
    const message = row as {
      profiles: MessageWithProfile['profiles'] | NonNullable<MessageWithProfile['profiles']>[];
    } & MessageWithProfile;
    const profiles = Array.isArray(message.profiles)
      ? (message.profiles[0] ?? null)
      : message.profiles;

    return { ...message, profiles };
  }
}
