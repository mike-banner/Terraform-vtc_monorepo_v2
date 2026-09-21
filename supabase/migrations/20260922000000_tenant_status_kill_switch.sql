-- ============================================================================
-- 20260922000000_tenant_status_kill_switch.sql
--
-- Le "Kill Switch" du superadmin (`apps/superadmin/src/pages/TenantsList.tsx`)
-- écrivait `tenants.status` : colonne inexistante -> l'UPDATE échouait et la
-- suspension d'une entreprise ne marchait pas.
--
-- 1. Ajout de la colonne `status`.
-- 2. Policy UPDATE réservée aux `super_admin` (lecture déjà couverte par
--    `tenants_platform_admin_read`).
-- 3. L'effet est appliqué côté backoffice (voir `apps/vtc-backoffice/src/middleware.ts`).
-- ============================================================================

alter table public.tenants
  add column if not exists status text not null default 'active';

alter table public.tenants
  drop constraint if exists tenants_status_check;

alter table public.tenants
  add constraint tenants_status_check check (status in ('active', 'suspended'));

-- Suspension / réactivation : super_admin uniquement (pas platform_staff).
drop policy if exists tenants_platform_admin_write on public.tenants;
create policy tenants_platform_admin_write on public.tenants
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.platform_role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.platform_role = 'super_admin'
    )
  );

-- Les tenants existants passent à 'active' via le DEFAULT de l'ADD COLUMN.
