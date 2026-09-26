#!/usr/bin/env node
// Copie le planning du Vault Obsidian vers docs/planning/, versionné dans le repo.
//
// `.planning/` est un symlink vers MASTER_BRAIN/03-PROJECTS/vtc_repo_v2 : son contenu
// est donc invisible pour git. Le Vault reste l'endroit où le planning est lu et édité
// (Hermes y trie les notes) ; docs/planning/ en est la copie versionnée, pour que les
// autres agents et humains du repo voient le même état de projet.
//
// À lancer avant de commiter une mise à jour de planning. Sans ça, les deux copies
// divergent en silence.
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs";

const SRC = ".planning";
const DEST = "docs/planning";

if (!existsSync(SRC)) {
  console.error(`${SRC} introuvable — le symlink vers le Vault est-il monté ?`);
  process.exit(1);
}

// Artefacts régénérables, exclus : graphs/ pèse ~5,7 Mo de sortie graphify et
// claude-mem/ est une base de mémoire reconstruite. Rien de tout ça n'est du planning.
const EXCLUDE = new Set(["graphs", "claude-mem"]);

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
// dereference: true — on suit le symlink pour copier le contenu réel, pas le lien.
cpSync(SRC, DEST, {
  recursive: true,
  dereference: true,
  filter: (src) => !EXCLUDE.has(src.split("/").pop()),
});
console.log(`Planning synchronisé : ${SRC} -> ${DEST} (exclus : ${[...EXCLUDE].join(", ")})`);
