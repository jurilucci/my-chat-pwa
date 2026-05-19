--
-- chat (Sprint 2–4)
--

-- public.chat_rooms

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

comment on table public.chat_rooms is 'Chat rooms.';

-- public.messages

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id)
    on delete cascade,
  user_id uuid not null references auth.users (id)
    on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

comment on table public.messages is 'Chat messages.';

create index messages_room_id_created_at_idx on public.messages (room_id, created_at desc);

alter table public.messages
add constraint messages_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (user_id);

-- public.push_subscriptions

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id)
    on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique (user_id, endpoint)
);

comment on table public.push_subscriptions is 'Web Push subscriptions (VAPID).';

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
