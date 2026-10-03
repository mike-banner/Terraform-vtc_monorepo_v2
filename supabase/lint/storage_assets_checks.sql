-- Bucket « assets » : écriture limitée à logos/<son tenant>/ pour owner et manager.
-- La suppression n'est pas testable ici (storage.protect_delete interdit le DELETE SQL) : elle est couverte par tests/backoffice-settings.spec.ts.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

INSERT INTO storage.objects (bucket_id, name) VALUES
  ('assets', 'logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png');

SET LOCAL ROLE authenticated;

-- Owner du tenant A
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('owner : dépôt dans son dossier', $q$insert into storage.objects (bucket_id, name) values ('assets','logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$);
SELECT pg_temp.expect_ok('owner : remplacement dans son dossier', $q$update storage.objects set name = name where name = 'logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png'$q$);
SELECT pg_temp.expect_denied('owner : dépôt chez le tenant B', $q$insert into storage.objects (bucket_id, name) values ('assets','logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/autre.png')$q$);
SELECT pg_temp.expect_denied('owner : dépôt hors logos/', $q$insert into storage.objects (bucket_id, name) values ('assets','divers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/x.png')$q$);

-- Chauffeur du tenant A : aucune écriture
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('driver : dépôt refusé', $q$insert into storage.objects (bucket_id, name) values ('assets','logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/driver.png')$q$);

RESET ROLE;
ROLLBACK;
