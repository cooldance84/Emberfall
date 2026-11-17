# Online daily board (Supabase)

The daily challenge board can be shared between players through a free Supabase project. It is optional: with an empty `online-config.js` the game runs exactly as before and keeps the board on each device.

How it works: when a player signs a daily result, the game posts it to a table in your Supabase project; the board screen (title screen: **3**, then **B**; or **B** and A/D) reads today's rows back. Everything goes through Supabase's REST API with the **public anon key**. That key is meant to be public; what it can do is limited by the row-level-security rules below (read all rows, add a row for today, nothing else: no edit, no delete).

## Set-up

1. Create a project at https://supabase.com (free plan is enough). Pick any region.
2. Open **SQL Editor > New query**, paste the whole block below and press **Run**.
3. Open **Project Settings > API**. Copy the **Project URL** (`https://<project id>.supabase.co`) and the **anon public** key. In the newer dashboard it is called **Publishable key** (`sb_publishable_...`, under **API Keys**); never use the secret or `service_role` key.
4. Put them into `online-config.js` in this repo (`url` and `key`), commit and push. Do **not** use the `service_role` key anywhere in the game.
5. Open the game, finish or abandon a daily run, sign the board: the result appears on the board marked "ONLINE BOARD".

```sql
create table public.daily_scores (
  id bigint generated always as identity primary key,
  day date not null,
  name text not null check (name ~ '^[A-Z]{3}$'),
  hero text not null check (hero in ('nolan', 'panni', 'luca')),
  t integer not null check (t >= 0 and t <= 10368000),            -- play time in 60 Hz frames, at most 48 hours
  lv integer not null check (lv between 1 and 70),
  pg integer not null check (pg between 0 and 100),
  stage integer not null check (stage between 1 and 35),
  cycle integer not null check (cycle between 1 and 11),
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  -- a finished race needs level 70 + 100 paragon and cannot be shorter than 20 minutes (a placeholder, raise it when you know the real record)
  check (not finished or (lv = 70 and pg = 100 and t >= 72000))
);
create index on public.daily_scores (day);

alter table public.daily_scores enable row level security;
create policy "anyone can read" on public.daily_scores for select to anon using (true);
create policy "anyone can add a score for today" on public.daily_scores for insert to anon
  with check (day between current_date - 1 and current_date + 1);
grant select, insert on public.daily_scores to anon;
```

## Test row

To see the board work without playing a whole race, add a row by hand in the SQL editor (the editor ignores the rules above). The time is in frames, 60 per second: 72000 = 20:00.

```sql
insert into public.daily_scores (day, name, hero, t, lv, pg, stage, cycle, finished)
values (current_date, 'KTZ', 'nolan', 72000, 70, 100, 35, 3, true);
-- remove it again:
-- delete from public.daily_scores where name = 'KTZ';
```

`current_date` is the server's (UTC) day; the game uses the player's local date, so late in the evening use that date instead.

## Cloud save (optional, v1.41)

The cloud save keeps your heroes in one more table. Nobody can read or write the table directly: only two functions are open, and both need the whole 12-character sync code, which only the player's devices know. Paste this into the SQL editor (the SQL itself, not the file name) and run it once:

```sql
create table if not exists public.cloud_saves (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  data jsonb not null check (octet_length(data::text) <= 100000),
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security; -- no policies: the table itself is closed
revoke all on public.cloud_saves from anon, authenticated;

create or replace function public.cloud_get(p_code text) returns jsonb
language sql security definer set search_path = public stable as $$
  select data from public.cloud_saves where code = p_code
$$;

create or replace function public.cloud_put(p_code text, p_data jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cloud_saves (code, data, updated_at) values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
  return true;
end $$;

revoke all on function public.cloud_get(text), public.cloud_put(text, jsonb) from public;
grant execute on function public.cloud_get(text), public.cloud_put(text, jsonb) to anon;
```

How it is used: on the first device press **C** on the title screen, then UPLOAD (a code is made and shown). On the second device press ENTER CODE, type the code, then DOWNLOAD. Typing `NEW` instead of a code makes a fresh one. Each overwrite needs a second press, and the screen shows the level of every hero on this device and in the cloud first.

## Limits, honestly

- The result is reported by the player's own device, so it can be faked: anyone can send a request with the public key. The rules above only stop nonsense (bad names, impossible levels, absurd times, old days). They cannot prove a race was played.
- Rows are never edited or deleted by players. You can clean the table in the Supabase dashboard (Table Editor).
- The all-time board stays on each device; only the daily board is online.
- A player in another time zone can be on a different "day" for a few hours; the server accepts the day before and after today.
- Cloud save: whoever knows a sync code can read and replace that save, so the code is the password. It has 60 bits of randomness, so it cannot be guessed, but do not post it. To retire a leaked code, delete its row in the Table Editor (`cloud_saves`), then type `NEW` in ENTER CODE for a fresh code and upload again.
- Anyone with the public key can also write junk rows into `cloud_saves` (each at most 100 KB); clean them in the Table Editor if it ever happens. The seal on the saves is a deterrent only: a hand-made save can still be put into the cloud under a fresh code.
