import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseArgs, parseEnv } from 'node:util';
import { hashPassword } from '../lib/auth.mjs';
import { projectRoot, readConfig, validAdminUsername } from '../lib/config.mjs';

const filename = join(projectRoot, '.env');

async function askForAccount(defaultUsername) {
  if (!process.stdin.isTTY) throw new Error('برای تنظیم حساب مدیریت، این دستور را در ترمینال تعاملی اجرا کنید.');

  let hidden = false;
  const terminal = new Writable({
    write(chunk, encoding, done) {
      if (hidden) done();
      else process.stdout.write(chunk, encoding, done);
    },
  });
  const input = createInterface({ input: process.stdin, output: terminal, terminal: true });
  input.once('SIGINT', () => process.exit(130));
  async function passwordPrompt(prompt) {
    hidden = true;
    process.stdout.write(prompt);
    try {
      return await input.question('');
    } finally {
      process.stdout.write('\n');
      hidden = false;
    }
  }

  try {
    const username = (await input.question(`نام کاربری مدیریت [${defaultUsername}]: `)).trim() || defaultUsername;
    if (!validAdminUsername(username)) {
      throw new Error('نام کاربری باید ۱ تا ۶۴ نویسه و شامل حروف لاتین، عدد یا . _ @ - باشد و با حرف یا عدد شروع شود.');
    }
    const password = await passwordPrompt('رمز مدیریت (۱۲ تا ۲۰۰ نویسه): ');
    if (password.length < 12 || password.length > 200) throw new Error('رمز باید بین ۱۲ تا ۲۰۰ نویسه باشد.');
    if (password !== await passwordPrompt('تکرار رمز مدیریت: ')) throw new Error('دو رمز یکسان نیستند.');
    return {
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD_HASH: await hashPassword(password),
      SESSION_SECRET: randomBytes(32).toString('hex'),
    };
  } finally {
    input.close();
  }
}

function applySettings(contents, settings) {
  for (const [name, value] of Object.entries(settings)) {
    const assignment = new RegExp(`^[ \\t]*${name}[ \\t]*=.*$`, 'm');
    contents = assignment.test(contents)
      ? contents.replace(assignment, () => `${name}=${value}`)
      : `${contents.trimEnd()}\n${name}=${value}\n`;
  }
  return contents;
}

function deploymentSettings() {
  const origin = process.env.HEYAT_DEPLOY_ORIGIN || '';
  const basePath = process.env.HEYAT_DEPLOY_BASE_PATH ?? '';
  const port = process.env.HEYAT_DEPLOY_PORT || '';
  if (!/^https:\/\/[a-z0-9.-]+$/.test(origin) ||
      !/^(?:\/[A-Za-z0-9_-]+)*$/.test(basePath) ||
      !/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error('تنظیمات دامنه، مسیر یا پورت نصب معتبر نیست.');
  }
  return {
    PUBLIC_BASE_URL: origin, BASE_PATH: basePath, SURVEY_PORT: port,
    BIND_ADDRESS: '127.0.0.1', COOKIE_SECURE: 'true', TRUST_PROXY: 'true',
  };
}

async function setup() {
  const { values } = parseArgs({ options: {
    'reset-admin': { type: 'boolean' },
    'configure-deployment': { type: 'boolean' },
  } });
  const reset = values['reset-admin'];
  const deploy = values['configure-deployment'];
  const file = lstatSync(filename, { throwIfNoEntry: false });
  if (file && !file.isFile()) throw new Error('مسیر .env باید یک فایل معمولی باشد.');
  if (file && !reset && !deploy) {
    throw new Error('فایل .env از قبل وجود دارد. برای تغییر حساب مدیریت، npm run setup -- --reset-admin را اجرا کنید.');
  }

  const contents = readFileSync(file ? filename : join(projectRoot, '.env.example'), 'utf8').replaceAll('\r\n', '\n');
  const current = parseEnv(contents);
  if (deploy && (current.ADMIN_PASSWORD_HASH_FILE || current.SESSION_SECRET_FILE)) {
    throw new Error('برای فایل‌های جداگانهٔ اسرار، تنظیمات Docker را طبق راهنمای دستی انجام دهید.');
  }
  const settings = deploy ? deploymentSettings() : {};
  const createAccount = reset || !file || (deploy && !current.ADMIN_PASSWORD_HASH && !current.SESSION_SECRET);
  if (createAccount) {
    const previousUsername = current.ADMIN_USERNAME || '';
    Object.assign(settings, await askForAccount(validAdminUsername(previousUsername) ? previousUsername : 'admin'));
  } else if (!current.ADMIN_USERNAME) {
    settings.ADMIN_USERNAME = 'admin';
  }

  const next = applySettings(contents, settings);
  const parsed = parseEnv(next);
  if (deploy && Object.entries(settings).some(([name, value]) => parsed[name] !== value)) {
    throw new Error('فایل .env مقدار تکراری یا تعریف ناسازگار دارد.');
  }
  readConfig(parsed);

  const temporary = join(projectRoot, `.env.${randomBytes(8).toString('hex')}.tmp`);
  try {
    writeFileSync(temporary, next, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, filename);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  if (deploy) {
    console.log(createAccount ? 'حساب مدیریت و تنظیمات نصب ذخیره شد.' : 'تنظیمات نصب ذخیره شد و حساب مدیریت قبلی قابل استفاده است.');
  } else {
    console.log(reset ? 'حساب مدیریت به‌روز شد. برنامه را دوباره اجرا کنید.' : 'تنظیمات ساخته شد. اکنون npm start یا docker compose up -d --build را اجرا کنید.');
  }
}

try {
  await setup();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
