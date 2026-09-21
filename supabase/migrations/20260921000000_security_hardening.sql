-- ============================================================================
-- 20260921000000_security_hardening.sql
--
-- Correctifs de sécurité critiques :
--   1. Escalade de privilèges : un utilisateur authentifié pouvait modifier sa
--      propre ligne `profiles` (policy `profiles_update_own`) et s'attribuer
--      `platform_role = 'super_admin'` ou `tenant_id` d'un autre tenant.
--      -> policy resserrée + trigger de garde.
--   2. Lecture publique (rôle `anon`) des tables `bookings`, `customers` et
--      `stripe_events` (policies `to anon using (true)`). La clé publishable
--      étant publique, n'importe qui pouvait aspirer toute la base clients.
--   3. Lecture publique de la ligne complète `tenants` (fuite de
--      `stripe_account_id`, SIRET, TVA, adresses...).
--
-- Les besoins réels des sites publics (page success, résolution de tenant) sont
-- couverts par deux fonctions SECURITY DEFINER qui n'exposent que les colonnes
-- nécessaires.
--
-- ⚠️ Les policies supprimées ci-dessous étaient toujours actives (aucune
--    migration ultérieure ne les droppait).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. `profiles` : interdire l'auto-attribution de rôles / tenant
-- ----------------------------------------------------------------------------
-- Note : fonction volontairement NON `security definer`. `current_user` reflète
-- donc le rôle effectif de l'appelant (PostgREST fait `SET LOCAL ROLE`), ce qui
-- permet de ne filtrer que les appels API `anon` / `authenticated`.
-- Les fonctions SECURITY DEFINER existantes (approve_onboarding_tx,
-- delete_tenant_account, handle_new_user, service_role...) tournent en tant que
-- `postgres`/`service_role` et ne sont donc jamais bloquées.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Hors API publique : service_role, hooks auth, fonctions SECURITY DEFINER.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.platform_role is not null then
      raise exception 'profiles: platform_role ne peut pas être auto-attribué'
        using errcode = '42501';
    end if;
    if new.tenant_id is not null then
      raise exception 'profiles: tenant_id ne peut pas être auto-attribué'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.platform_role is distinct from old.platform_role
     or new.tenant_role is distinct from old.tenant_role
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'profiles: platform_role / tenant_role / tenant_id sont gérés par la plateforme'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_escalation on public.profiles;
create trigger trg_profiles_prevent_escalation
  before insert or update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

-- La policy d'origine était `for update using (id = auth.uid())`, sans WITH CHECK.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Suppression des lectures publiques de données clients / paiements
-- ----------------------------------------------------------------------------
drop policy if exists "public_read_bookings" on public.bookings;
drop policy if exists "public read bookings" on public.bookings;
drop policy if exists "Allow public read booking by ID" on public.bookings;

drop policy if exists "public_read_customers" on public.customers;
drop policy if exists "public read customers" on public.customers;
drop policy if exists "Allow public read customer by ID" on public.customers;

drop policy if exists "public_read_stripe_events" on public.stripe_events;
drop policy if exists "public read stripe_events" on public.stripe_events;

-- ----------------------------------------------------------------------------
-- 3. Suppression de la lecture publique de la ligne `tenants` complète
--    (remplacée par `get_public_tenant` ci-dessous)
-- ----------------------------------------------------------------------------
drop policy if exists "public_read_tenants" on public.tenants;
drop policy if exists "Allow public read of tenants" on public.tenants;

-- Les platform admins conservent leur accès (`tenants_platform_admin_read`)
-- et chaque tenant garde l'accès à sa propre ligne (`tenants_select_own`).

-- ----------------------------------------------------------------------------
-- 4. RPC publiques restreintes (remplacement des lectures anon)
-- ----------------------------------------------------------------------------

-- Champs publics d'un tenant, pour la résolution d'hôte des sites vitrines.
create or replace function public.get_public_tenant(
  p_host text,
  p_id uuid default null
)
returns table (
  id uuid,
  name text,
  logo_url text,
  primary_domain text,
  phone text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.logo_url, t.primary_domain, t.phone, t.email
  from public.tenants t
  where (p_id is not null and t.id = p_id)
     or (p_id is null and p_host is not null and t.primary_domain = p_host)
  limit 1;
$$;

revoke all on function public.get_public_tenant(text, uuid) from public;
grant execute on function public.get_public_tenant(text, uuid) to anon, authenticated;

-- Résultat d'une réservation payée, pour la page /success (clé = session Stripe,
-- valeur non devinable). N'expose que les colonnes affichées au client.
create or replace function public.get_public_booking_result(p_session_id text)
returns table (
  booking_id uuid,
  pickup_address text,
  dropoff_address text,
  total_amount numeric,
  customer_first_name text,
  customer_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.pickup_address, b.dropoff_address, b.total_amount, c.first_name, c.email
  from public.stripe_events se
  join public.bookings b on b.id = se.booking_id
  left join public.customers c on c.id = b.customer_id
  where se.session_id = p_session_id
    and se.booking_id is not null
  order by se.created_at desc
  limit 1;
$$;

revoke all on function public.get_public_booking_result(text) from public;
grant execute on function public.get_public_booking_result(text) to anon, authenticated;
