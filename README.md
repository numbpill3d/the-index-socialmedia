# THE INDEX

collaborative directory of digital artifacts. community-curated link catalog with realtime sync, oauth auth, and stamp system.

## stack

- react 19 + typescript + vite
- tailwind css 4
- supabase (postgres, auth, storage, realtime)

## setup

### 1. supabase project

create a project at supabase.com, then run this sql in the sql editor:

```sql
-- drawers (categories)
create table drawers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- cards (resources)
create table cards (
  id uuid default gen_random_uuid() primary key,
  drawer_id uuid references drawers(id) on delete cascade,
  title text not null,
  url text not null,
  description text,
  submitted_by uuid references auth.users(id),
  submitted_by_name text,
  stamp_count int default 0,
  image_url text,
  embed_type text default 'none',
  iframe_url text,
  created_at timestamptz default now()
);

-- stamps (user bookmarks)
create table stamps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, card_id)
);

-- rpc functions for stamp counts
create or replace function increment_stamp_count(card_id_input uuid)
returns void language plpgsql as $$
begin
  update cards set stamp_count = stamp_count + 1 where id = card_id_input;
end;
$$;

create or replace function decrement_stamp_count(card_id_input uuid)
returns void language plpgsql as $$
begin
  update cards set stamp_count = greatest(0, stamp_count - 1) where id = card_id_input;
end;
$$;

-- enable realtime
alter publication supabase_realtime add table drawers;
alter publication supabase_realtime add table cards;
alter publication supabase_realtime add table stamps;

-- rls policies (enable rls first)
alter table drawers enable row level security;
alter table cards enable row level security;
alter table stamps enable row level security;

create policy "public read drawers" on drawers for select using (true);
create policy "auth insert drawers" on drawers for insert with check (auth.role() = 'authenticated');

create policy "public read cards" on cards for select using (true);
create policy "auth insert cards" on cards for insert with check (auth.role() = 'authenticated');
create policy "update stamp count" on cards for update using (true);

create policy "read own stamps" on stamps for select using (auth.uid() = user_id);
create policy "insert own stamps" on stamps for insert with check (auth.uid() = user_id);
create policy "delete own stamps" on stamps for delete using (auth.uid() = user_id);
```

### 2. storage bucket

in supabase dashboard → storage → create bucket named `card-images`, set to **public**.

### 3. oauth providers (optional)

supabase dashboard → authentication → providers → enable google and/or github. set redirect url to your domain.

### 4. local dev

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from supabase dashboard → settings → api
npm install
npm run dev
# opens at http://localhost:3000
```

### 5. production build

```bash
npm run build
# output in dist/ — deploy to vercel, netlify, cloudflare pages, etc.
```

## deploy to vercel

```bash
npx vercel --prod
# set env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in vercel dashboard
```
