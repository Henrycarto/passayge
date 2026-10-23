// Fails if personal data could leave the sandbox or sits in the repository.
//  1. The maintainer's email address must not appear in any file. It is checked by SHA-256 hash,
//     so this script does not contain the address itself.
//  2. Code that builds outbound requests must not contain any email address or the maintainer's
//     name, and every User-Agent it sets must be the app's own identifier.
// Run: node scripts/check-personal-data.mjs

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EMAIL_HASHES = new Set(['19f1ad747774f628c2618a253271b832bfe545792f4d3b4f99f652066d758363']);
const NAME_HASHES = new Set(['dde2fe7d09544be253d624e88ceac24b3780c3e2f4337ee34b61b56f422be287']);
const USER_AGENT = 'Passayge/0.1 (https://henrycarto.com)';

/** Files that build or send requests to anything outside the browser. */
const REQUEST_CODE = [/^apps\/gateway\/src\//, /^apps\/web\/src\/lib\/api\.ts$/, /^scripts\//, /^infra\//, /^docker-compose\.yml$/, /^\.github\/workflows\//];

const sha = (s) => createHash('sha256').update(s.toLowerCase()).digest('hex');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BINARY = /\.(png|gif|jpe?g|ico|ttf|woff2?|tgz|zip|pdf)$/i;

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const problems = [];

for (const file of files) {
  if (BINARY.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const isRequestCode = REQUEST_CODE.some((r) => r.test(file));
  for (const m of text.matchAll(EMAIL)) {
    if (EMAIL_HASHES.has(sha(m[0]))) problems.push(`${file}: contains the maintainer's email address`);
    else if (isRequestCode && file !== 'scripts/check-personal-data.mjs') problems.push(`${file}: email address in request code (${m[0]})`);
  }
  if (!isRequestCode) continue;
  const words = text.split(/[^A-Za-zÀ-ž]+/).filter(Boolean);
  for (let i = 0; i + 1 < words.length; i++) {
    if (NAME_HASHES.has(sha(`${words[i]} ${words[i + 1]}`))) problems.push(`${file}: contains the maintainer's name in request code`);
  }
  for (const m of text.matchAll(/user-agent['"]?\s*[:=,]\s*['"`]([^'"`]*)['"`]/gi)) {
    if (m[1] !== USER_AGENT && m[1] !== '${USER_AGENT}') problems.push(`${file}: User-Agent "${m[1]}" is not "${USER_AGENT}"`);
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`Personal data check passed (${files.length} files).`);
