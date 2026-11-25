import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { projectRoot } from '../lib/config.mjs';
import { makeZip } from '../lib/zip.mjs';

const files = [];
function add(relative) {
  const target = resolve(projectRoot, relative);
  const entries = readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Release inputs may not be symlinks.');
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) add(path);
    else if (entry.isFile()) files.push({ name: path, data: readFileSync(resolve(projectRoot, path)) });
  }
}
for (const directory of ['dist', 'lib', 'tools', 'test', 'deploy']) add(directory);
for (const name of ['server.mjs', 'package.json', '.gitignore', '.env.example', '.dockerignore', 'Dockerfile', 'compose.yaml', 'README.md', 'HANDOFF.md', 'TESTING.md', 'LOGO-NOTES.md']) files.push({ name, data: readFileSync(join(projectRoot, name)) });
const manifest = { version: '2.0.0', requires_node: '>=22.13.0', files: files.map(file => ({ path: file.name, sha256: createHash('sha256').update(file.data).digest('hex') })) };
files.push({ name: 'RELEASE-MANIFEST.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });
const directory = join(projectRoot, 'release');
mkdirSync(directory, { recursive: true });
const filename = join(directory, 'heyat-survey-final.zip');
const archive = makeZip(files.map(file => ({ name: `heyat-survey/${file.name}`, data: file.data })));
writeFileSync(filename, archive);
const hash = createHash('sha256').update(archive).digest('hex');
writeFileSync(`${filename}.sha256`, `${hash}  heyat-survey-final.zip\n`);
console.log(JSON.stringify({ archive: filename, files: files.length, bytes: archive.length, sha256: hash }));
