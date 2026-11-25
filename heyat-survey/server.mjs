const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('این برنامه به Node.js نسخهٔ 22.13 یا بالاتر نیاز دارد.');
  process.exit(1);
}
const { startServer } = await import('./lib/http.mjs');
await startServer();
