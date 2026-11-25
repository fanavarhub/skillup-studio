import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectRoot } from '../lib/config.mjs';

const files = ['server.mjs'];
for (const directory of ['lib', 'dist', 'tools', 'test']) {
  const root = resolve(projectRoot, directory);
  for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isFile() && /\.(m?js)$/.test(entry.name)) files.push(join(directory, entry.name));
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', resolve(projectRoot, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked: ${files.length} JavaScript modules.`);
