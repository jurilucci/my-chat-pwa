// deno-lint-ignore no-import-prefix no-unversioned-import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { supabaseAdminClient } from '@shared/clients/supabase-admin.client.ts';
import { COMMON_HEADERS } from '@shared/constants/common-headers.constant.ts';
import { SupabaseTable } from '@shared/enums/supabase-table.enum.ts';
import webpush from 'web-push';

interface DatabaseWebhookPayload {
  record: MessageRecord;
  schema: string;
  table: string;
  type: 'INSERT';
}

interface MessageRecord {
  body: string;
  id: string;
  room_id: string;
  user_id: string;
}

interface PushSubscriptionRow {
  auth: string;
  endpoint: string;
  p256dh: string;
  user_id: string;
}

Deno.serve(async (request: Request): Promise<Response> => {
  console.info('send-push-on-message', request.method);

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: COMMON_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: COMMON_HEADERS,
        status: 405,
      });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.');
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload: DatabaseWebhookPayload = await request.json();
    const message = payload.record;

    if (payload.type !== 'INSERT' || payload.table !== SupabaseTable.Messages) {
      return new Response(JSON.stringify({ skipped: true }), { headers: COMMON_HEADERS });
    }

    const { data: senderProfile } = await supabaseAdminClient
      .from(SupabaseTable.Profiles)
      .select('username, full_name')
      .eq('user_id', message.user_id)
      .maybeSingle();

    const senderLabel =
      senderProfile?.full_name ?? senderProfile?.username ?? message.user_id.slice(0, 8);

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdminClient
      .from(SupabaseTable.PushSubscriptions)
      .select('endpoint, p256dh, auth, user_id')
      .neq('user_id', message.user_id);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    const pushPayload = JSON.stringify({
      notification: {
        body: `${senderLabel}: ${message.body}`,
        data: {
          onActionClick: {
            default: { operation: 'navigateLastFocusedOrOpen', url: `/chat/${message.room_id}` },
          },
          roomId: message.room_id,
        },
        title: 'Nuovo messaggio',
      },
    });

    let sent = 0;

    for (const row of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
          pushPayload,
        );
        sent += 1;
      } catch (error) {
        console.warn('Push failed for', row.user_id, error);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions?.length ?? 0 }), {
      headers: COMMON_HEADERS,
    });
  } catch (exception: unknown) {
    console.error(exception);

    const message = exception instanceof Error ? exception.message : 'Something went wrong.';

    return new Response(JSON.stringify({ error: message }), {
      headers: COMMON_HEADERS,
      status: 500,
    });
  }
});
