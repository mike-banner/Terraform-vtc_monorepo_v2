#!/usr/bin/env bash
# Accès au bucket R2 privé du développeur : registre des instances (sans secret) et contenu des sites clients.
# Jeton limité à ce bucket, lu dans l'environnement de la machine ; jamais dans le dépôt ni dans GitHub.
#
# Usage :
#   r2-prive.sh get <clé> <fichier hors dépôt>
#   r2-prive.sh put <fichier> <clé>
#   r2-prive.sh sites <code>... [--archive <code>=<fichier.tar.gz>]
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SITES="$ROOT/apps/vtc-websites/src/sites"
CODE_RE='^[a-z0-9_-]{2,40}$'

die() { echo "r2-prive : $*" >&2; exit 1; }

need() {
  local missing=() v
  for v in R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
    [ -n "${!v:-}" ] || missing+=("$v")
  done
  [ ${#missing[@]} -eq 0 ] || die "variables manquantes : ${missing[*]}"
}

# Identifiants passés par l'entrée standard : absents de la ligne de commande et de ps.
req() {
  printf 'user = "%s:%s"\n' "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" |
    curl -K - --fail --silent --show-error --aws-sigv4 "aws:amz:auto:s3" "$@"
}

tracked() { git -C "$ROOT" ls-files -- "apps/vtc-websites/src/sites/$1" | grep -q .; }

# Récupère (ou prend dans --archive) le site <code> et l'extrait dans src/sites/<code>.
fetch_site() {
  local code="$1" arc="${2:-}" tmp list
  [[ "$code" =~ $CODE_RE ]] || die "code de site invalide"
  tracked "$code" && return 0 # suivi par git (démonstration, modèle) : rien à récupérer
  tmp="$(mktemp)"; trap 'rm -f "$tmp"' RETURN
  if [ -n "$arc" ]; then
    cp "$arc" "$tmp"
  else
    need
    req -o "$tmp" "$R2_ENDPOINT/$R2_BUCKET/sites/$code.tar.gz" || die "archive introuvable pour le site $code"
  fi
  list="$(tar -tzf "$tmp" | sed 's,^\./,,')" || die "archive illisible pour le site $code"
  if grep -qE '(^/|(^|/)\.\.(/|$))' <<<"$list"; then die "archive refusée pour le site $code : chemin absolu ou .."; fi
  if grep -E '^pages/.' <<<"$list" | grep -qvx 'pages/index.astro'; then
    die "archive refusée pour le site $code : un site ne fournit que pages/index.astro ; les tunnels sont communs"
  fi
  rm -rf "${SITES:?}/$code"
  mkdir -p "$SITES/$code"
  tar -xzf "$tmp" --no-same-owner -C "$SITES/$code"
  if [ ! -f "$SITES/$code/pages/index.astro" ] || [ ! -f "$SITES/$code/config.ts" ]; then
    rm -rf "${SITES:?}/$code"
    die "site $code incomplet : pages/index.astro et config.ts sont requis"
  fi
  echo "site récupéré : $code"
}

cmd="${1:-}"; [ $# -gt 0 ] && shift
case "$cmd" in
  get)
    [ $# -eq 2 ] || die "usage : get <clé> <fichier>"
    need
    dest_dir="$(cd "$(dirname "$2")" && pwd)"
    top="$(git -C "$dest_dir" rev-parse --show-toplevel 2>/dev/null || true)"
    [ "$top" != "$ROOT" ] || die "le registre ne va jamais dans le dépôt"
    req -o "$2" "$R2_ENDPOINT/$R2_BUCKET/$1"
    ;;
  put)
    [ $# -eq 2 ] || die "usage : put <fichier> <clé>"
    need
    req -T "$1" "$R2_ENDPOINT/$R2_BUCKET/$2"
    ;;
  sites)
    codes=(); declare -A archives=()
    while [ $# -gt 0 ]; do
      if [ "$1" = "--archive" ]; then
        [ $# -ge 2 ] && [[ "$2" == *=* ]] || die "usage : --archive <code>=<fichier>"
        archives["${2%%=*}"]="${2#*=}"; shift 2
      else codes+=("$1"); shift; fi
    done
    [ ${#codes[@]} -gt 0 ] || die "aucun code de site"
    for c in "${codes[@]}"; do fetch_site "$c" "${archives[$c]:-}"; done
    # retire tout dossier de site non suivi et absent de la liste (contenu d'un autre client)
    for d in "$SITES"/*/; do
      [ -d "$d" ] || continue
      n="$(basename "$d")"
      tracked "$n" && continue
      [[ " ${codes[*]} " == *" $n "* ]] && continue
      rm -rf "${d:?}"; echo "dossier de site retiré : $n"
    done
    ;;
  *) die "usage : get | put | sites (voir l'en-tête)" ;;
esac
