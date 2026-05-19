--
-- Chat: allow reading other users' display names (full_name, username)
--

create policy "Allow authenticated to select profiles for chat display" on public.profiles
as permissive
for select
to authenticated
using (true);
