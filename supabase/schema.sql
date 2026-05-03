-- Run this in your Supabase SQL editor:
-- Dashboard → SQL Editor → New query → paste this → Run

create table if not exists documents (
  id          text primary key,
  name        text not null,
  file_type   text default '',
  status      text not null default 'uploaded',
  extracted   text default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Allow all operations from the browser (anon key)
alter table documents enable row level security;

create policy "Allow all" on documents
  for all using (true) with check (true);
