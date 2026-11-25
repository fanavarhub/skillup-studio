import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../dist/assets/fonts/', import.meta.url);
await mkdir(directory, { recursive: true });
const assets = [
  ['Vazirmatn.woff2', 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/master/fonts/webfonts/Vazirmatn%5Bwght%5D.woff2'],
  ['Vazirmatn-OFL.txt', 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/master/OFL.txt'],
  ['Amiri-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf'],
  ['Amiri-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/OFL.txt'],
];
const results = await Promise.allSettled(assets.map(async ([name, url]) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  await writeFile(new URL(name, directory), data);
  return { name, bytes: data.length };
}));
for (const result of results) {
  if (result.status === 'fulfilled') console.log(`${result.value.name}: ${result.value.bytes} bytes`);
  else { console.error(result.reason.message); process.exitCode = 1; }
}
