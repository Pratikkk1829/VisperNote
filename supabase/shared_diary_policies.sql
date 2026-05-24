-- Shared diary RLS policies for VisperNote.
-- Run this in the Supabase SQL editor if invited diaries exist in group_members
-- but do not appear for the invited account.

create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_group_members(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group
      and g.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'admin')
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.entries enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Groups are readable by members" on public.groups;
create policy "Groups are readable by members"
on public.groups
for select
using (created_by = auth.uid() or public.is_group_member(id));

drop policy if exists "Users can create their own groups" on public.groups;
create policy "Users can create their own groups"
on public.groups
for insert
with check (created_by = auth.uid());

drop policy if exists "Group owners can update groups" on public.groups;
create policy "Group owners can update groups"
on public.groups
for update
using (created_by = auth.uid() or public.can_manage_group_members(id))
with check (created_by = auth.uid() or public.can_manage_group_members(id));

drop policy if exists "Group owners can delete groups" on public.groups;
create policy "Group owners can delete groups"
on public.groups
for delete
using (created_by = auth.uid());

create or replace function public.only_group_owner_can_change_design()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.design_json is distinct from old.design_json
     and old.created_by is distinct from auth.uid() then
    raise exception 'Only the diary owner can change the canvas design';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_design_owner on public.groups;
create trigger enforce_group_design_owner
before update of design_json on public.groups
for each row
execute function public.only_group_owner_can_change_design();

drop policy if exists "Members can read group memberships" on public.group_members;
create policy "Members can read group memberships"
on public.group_members
for select
using (user_id = auth.uid() or public.is_group_member(group_id));

drop policy if exists "Owners can add group members" on public.group_members;
create policy "Owners can add group members"
on public.group_members
for insert
with check (user_id = auth.uid() or public.can_manage_group_members(group_id));

drop policy if exists "Members or owners can remove group memberships" on public.group_members;
create policy "Members or owners can remove group memberships"
on public.group_members
for delete
using (user_id = auth.uid() or public.can_manage_group_members(group_id));

drop policy if exists "Entries are readable by group members" on public.entries;
create policy "Entries are readable by group members"
on public.entries
for select
using (public.is_group_member(group_id));

drop policy if exists "Members can create entries" on public.entries;
create policy "Members can create entries"
on public.entries
for insert
with check (public.is_group_member(group_id));

drop policy if exists "Members can update entries" on public.entries;
create policy "Members can update entries"
on public.entries
for update
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists "Members can delete entries" on public.entries;
create policy "Members can delete entries"
on public.entries
for delete
using (public.is_group_member(group_id));

drop policy if exists "Messages are readable by group members" on public.messages;
create policy "Messages are readable by group members"
on public.messages
for select
using (public.is_group_member(group_id));

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
on public.messages
for insert
with check (public.is_group_member(group_id) and user_id = auth.uid());

drop policy if exists "Members can update own messages" on public.messages;
create policy "Members can update own messages"
on public.messages
for update
using (public.is_group_member(group_id) and user_id = auth.uid())
with check (public.is_group_member(group_id) and user_id = auth.uid());

drop policy if exists "Members can delete own messages" on public.messages;
create policy "Members can delete own messages"
on public.messages
for delete
using (public.is_group_member(group_id) and user_id = auth.uid());

drop policy if exists "Group owners can delete group messages" on public.messages;
create policy "Group owners can delete group messages"
on public.messages
for delete
using (public.can_manage_group_members(group_id));
