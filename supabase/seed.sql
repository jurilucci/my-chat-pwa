-- Default demo room (Sprint 2: single-room chat)
insert into public.chat_rooms (id, name)
values ('00000000-0000-4000-8000-000000000001', 'General')
on conflict (id) do nothing;
