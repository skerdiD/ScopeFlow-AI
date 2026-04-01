create table if not exists public.todos (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz default now()
);

alter table public.todos enable row level security;

drop policy if exists "Allow anon read todos" on public.todos;
create policy "Allow anon read todos"
on public.todos
for select
to anon
using (true);

insert into public.todos (name)
select 'First test todo'
where not exists (
  select 1 from public.todos where name = 'First test todo'
);

insert into public.todos (name)
select 'Second test todo'
where not exists (
  select 1 from public.todos where name = 'Second test todo'
);
