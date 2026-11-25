import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SurveyStore } from '../lib/store.mjs';
import { projectRoot } from '../lib/config.mjs';

const output = resolve(projectRoot, process.env.BACKUP_DIR || 'backups');
mkdirSync(output, { recursive: true, mode: 0o700 });
const store = new SurveyStore(resolve(projectRoot, process.env.DATA_DIR || 'data'));
try {
  const filename = join(output, `survey-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  store.backup(filename);
  try { chmodSync(filename, 0o600); } catch { /* ACLs apply on Windows. */ }
  console.log(filename);
} finally { store.close(); }
