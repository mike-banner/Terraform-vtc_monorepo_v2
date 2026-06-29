alter table tenants
add column if not exists logo_url text,
add column if not exists favicon_url text,
add column if not exists primary_color text;
