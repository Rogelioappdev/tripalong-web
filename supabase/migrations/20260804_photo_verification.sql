-- Photo verification: live-selfie identity check. See
-- src/components/onboarding/LiveVerificationCapture.tsx (capture),
-- src/app/api/admin/verify-review/* (review), src/app/api/cron/verify-daily
-- (daily Claude triage). is_verified already existed as a column/badge
-- (PublicProfileModal.tsx) with nothing setting it — this is that pipeline.

alter table users add column if not exists is_admin boolean not null default false;

create table if not exists photo_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  selfie_path text not null, -- path within the private verification-selfies bucket
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  ai_label text check (ai_label in ('match', 'mismatch', 'unclear')), -- Claude's daily triage read; advisory only
  ai_notes text, -- Claude's short reasoning, shown to the human reviewer
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists photo_verifications_status_idx on photo_verifications(status);
create index if not exists photo_verifications_user_id_idx on photo_verifications(user_id);

alter table photo_verifications enable row level security;

drop policy if exists "Users can view their own verification rows" on photo_verifications;
create policy "Users can view their own verification rows"
  on photo_verifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own verification rows" on photo_verifications;
create policy "Users can create their own verification rows"
  on photo_verifications for insert
  with check (auth.uid() = user_id);

-- No update/delete policy for regular users — only the service-role key
-- (admin API routes) can transition status or delete rows.

-- Private bucket — never publicly readable like `avatars` is.
insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-selfies', 'verification-selfies', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own verification selfie" on storage.objects;
create policy "Users can upload their own verification selfie"
  on storage.objects for insert
  with check (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);

-- No select/update/delete policy for authenticated users — only the
-- service-role key (admin routes, via createSignedUrl) can read these back.
