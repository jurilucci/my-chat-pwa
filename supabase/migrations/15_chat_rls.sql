--
-- chat RLS
--

-- public.chat_rooms

alter table public.chat_rooms enable row level security;

grant select on table public.chat_rooms to authenticated;

create policy "Allow authenticated to select chat rooms" on public.chat_rooms
as permissive
for select
to authenticated
using (true);

-- public.messages

alter table public.messages enable row level security;

grant select, insert on table public.messages to authenticated;

create policy "Allow authenticated to select messages" on public.messages
as permissive
for select
to authenticated
using (true);

create policy "Allow authenticated to insert own messages" on public.messages
as permissive
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- public.push_subscriptions

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on table public.push_subscriptions to authenticated;

create policy "Allow authenticated to select own push subscriptions" on public.push_subscriptions
as permissive
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Allow authenticated to insert own push subscriptions" on public.push_subscriptions
as permissive
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Allow authenticated to update own push subscriptions" on public.push_subscriptions
as permissive
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Allow authenticated to delete own push subscriptions" on public.push_subscriptions
as permissive
for delete
to authenticated
using ((select auth.uid()) = user_id);
