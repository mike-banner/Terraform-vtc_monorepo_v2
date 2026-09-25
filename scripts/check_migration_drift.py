#!/usr/bin/env python3
"""Compare supabase/migrations/ aux migrations réellement appliquées sur le projet.

Existe parce que le dépôt a vécu plusieurs semaines avec 4 migrations jamais
appliquées, dont le Kill Switch tenant : le correctif était en fichier, marqué
« fait », et sans aucun effet en production. Rien ne le signalait.

Utilise l'API Management (un simple Personal Access Token suffit, pas besoin du
mot de passe de la base).
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.supabase.com/v1/projects/{ref}/database/migrations"
MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"


def local_versions() -> dict[str, str]:
    """{version: nom de fichier} — la version est le préfixe horodaté."""
    out = {}
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = f.name.split("_", 1)[0]
        if not version.isdigit():
            print(f"::warning::nom de migration inattendu, ignoré : {f.name}")
            continue
        out[version] = f.name
    return out


def remote_versions(ref: str, token: str) -> dict[str, str]:
    req = urllib.request.Request(
        API.format(ref=ref), headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            rows = json.load(r)
    except urllib.error.HTTPError as e:
        # Ne jamais laisser fuiter l'en-tête d'autorisation dans les logs CI.
        sys.exit(f"API Supabase: HTTP {e.code} sur /database/migrations")
    except urllib.error.URLError as e:
        sys.exit(f"API Supabase injoignable: {e.reason}")
    return {row["version"]: row.get("name") or "" for row in rows}


def main() -> int:
    ref = os.environ.get("SUPABASE_PROJECT_REF")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not ref or not token:
        sys.exit("SUPABASE_PROJECT_REF et SUPABASE_ACCESS_TOKEN sont requis")

    local = local_versions()
    remote = remote_versions(ref, token)

    missing = sorted(set(local) - set(remote))
    unknown = sorted(set(remote) - set(local))

    for v in unknown:
        # Appliquée sur la base sans fichier correspondant : appliquée à la main,
        # ou fichier renommé/supprimé. À savoir, mais pas bloquant.
        print(f"::warning::migration {v} ({remote[v]}) appliquée en base sans fichier local")

    if missing:
        print(f"::error::{len(missing)} migration(s) locale(s) jamais appliquée(s) sur {ref} :")
        for v in missing:
            print(f"  - {local[v]}")
        print("Appliquer avec `supabase db push`, ou retirer le fichier s'il est obsolète.")
        return 1

    print(f"OK — {len(local)} migrations locales, toutes appliquées sur {ref}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
