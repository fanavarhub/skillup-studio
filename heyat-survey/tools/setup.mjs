import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/auth.mjs';
import { projectRoot } from '../lib/config.mjs';

const filename = join(projectRoot, '.env');
const reset = process.argv.includes('--reset-admin');
if (existsSync(filename) && !reset) {
  console.error('فایل .env از قبل وجود دارد. برای تغییر رمز مدیریت، npm run setup -- --reset-admin را اجرا کنید.');
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error('این دستور را در ترمینال تعاملی اجرا کنید تا رمز به‌صورت مخفی دریافت شود.');
  process.exit(1);
}
const silent = new Writable({ write(chunk, encoding, callback) { callback(); } });
const input = createInterface({ input: process.stdin, output: silent, terminal: true });
async function question(prompt) { process.stdout.write(prompt); const value = await input.question(''); process.stdout.write('\n'); return value; }
try {
  const password = await question('رمز مدیریت (حداقل ۱۲ نویسه): ');
  if (password.length < 12 || password.length > 200) throw new Error('رمز باید بین ۱۲ تا ۲۰۰ نویسه باشد.');
  const confirmation = await question('تکرار رمز مدیریت: ');
  if (password !== confirmation) throw new Error('دو رمز یکسان نیستند.');
  const hash = await hashPassword(password);
  const secret = randomBytes(32).toString('hex');
  let contents;
  if (reset) {
    contents = readFileSync(filename, 'utf8');
    for (const [key, value] of [['ADMIN_PASSWORD_HASH', hash], ['SESSION_SECRET', secret]]) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      contents = pattern.test(contents) ? contents.replace(pattern, `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
    }
  } else {
    contents = readFileSync(join(projectRoot, '.env.example'), 'utf8').replace('ADMIN_PASSWORD_HASH=', `ADMIN_PASSWORD_HASH=${hash}`).replace('SESSION_SECRET=', `SESSION_SECRET=${secret}`);
  }
  writeFileSync(filename, contents, { encoding: 'utf8', mode: 0o600 });
  console.log(reset ? 'رمز مدیریت تغییر کرد. برنامه را دوباره اجرا کنید؛ نشست‌های قبلی اعتبار نخواهند داشت.' : 'تنظیمات ساخته شد. اکنون npm start یا docker compose up -d --build را اجرا کنید.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { input.close(); }
