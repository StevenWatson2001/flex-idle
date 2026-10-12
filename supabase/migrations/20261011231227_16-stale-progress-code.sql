-- #16 fix: lock_progress raised serialization_failure (40001) when the
-- server's numbers were stale. The API retries transactions that fail with
-- 40001, and this one fails the same way every time, so the request hung
-- until the caller gave up. It now raises our own code, FI002, which comes
-- straight back to the server, and the server prices the write again.
create or replace function private.lock_progress(p_player uuid, p_version bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_version bigint;
begin
  select progress_version into current_version
  from public.player_stats
  where player_id = p_player
  for update;
  if not found then
    raise exception 'no such player' using errcode = 'no_data_found';
  end if;
  if current_version <> p_version then
    raise exception 'progress changed since it was priced' using errcode = 'FI002';
  end if;
end;
$$;
