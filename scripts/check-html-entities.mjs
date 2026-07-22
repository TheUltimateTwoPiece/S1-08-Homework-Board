#!/usr/bin/env node
// scripts/check-html-entities.mjs
//
// CI grep test that fails if HTML entities appear in JSX/TS source
// files outside the legitimate allowlist.
//
// Why this exists: JSX renders text verbatim and does NOT decode HTML
// entities. `You're` in JSX renders as `You're`; `You&apos;re` renders
// as `You&apos;re` literally — a real user-visible bug we hit on the
// /notifications page. This script catches the bug class at the source
// boundary so it can't ever reach a user's browser.
//
// Allowlist: src/lib/brevo.ts. Its escapeHtml function legitimately
// *produces* entities as the intended output of the email templates it
// renders — those entities are correct in that context. Add new entries
// to ALLOWLIST only when you have another server-rendered HTML context
// (dangerouslySetInnerHTML, email templates, etc.) that genuinely wants
// entities in source.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Includes the canonical named entities + numeric character references
// in both decimal (`&#160;`) and hex form (`&#x27;` / `&#X27;`).
// Excludes the leading `&` and trailing `;` so a literal apostrophe
// `'you're` doesn't match.
const ENTITY_RE = /&(?:amp|lt|gt|quot|nbsp|copy|reg|apos|#[xX]?[0-9a-fA-F]+);/g;
const SOURCE_EXT = /\.(t|j)sx?$/;
const ROOT_DIR = "src";
const ALLOWLIST = new Set([path.join("src", "lib", "brevo.ts")]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const cwd = process.cwd();
const offenders = [];

for (const file of await walk(ROOT_DIR)) {
  const rel = path.relative(cwd, file);
  if (ALLOWLIST.has(rel)) continue;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ENTITY_RE.lastIndex = 0;
    if (ENTITY_RE.test(line)) {
      offenders.push({
        file: rel,
        line: i + 1,
        snippet: line.trim().slice(0, 120),
      });
    }
  }
}

if (offenders.length > 0) {
  process.stderr.write(
    "\n" +
      "Stray HTML entities in src/ (outside " +
      [...ALLOWLIST].join(", ") +
      "):\n\n",
  );
  for (const o of offenders) {
    process.stderr.write(`  ${o.file}:${o.line}  ${o.snippet}\n`);
  }
  process.stderr.write(
    "\n" +
      `Found ${offenders.length} occurrence(s).\n` +
      "JSX does not decode HTML entities — entities render literally in the browser.\n" +
      "Fix: replace the entity with the actual character " +
      "(e.g. use ' instead of &apos;, a regular space instead of &nbsp;).\n" +
      "src/lib/brevo.ts is the only allowlisted file; expand ALLOWLIST only with a documented reason.\n",
  );
  process.exit(1);
}

process.stdout.write(
  "OK — no stray HTML entities in src/ (outside " +
    [...ALLOWLIST].join(", ") +
    ").\n",
);
