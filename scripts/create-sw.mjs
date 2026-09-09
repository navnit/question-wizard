import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${path}/${e.name}`) : `${path}/${e.name}`))).flat();
}
const files = (await walk('dist')).filter(f => !f.endsWith('/sw.js'));
const hash = createHash('sha256');
for (const file of files.sort()) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);
const urls = files.map(f => `./${f.slice(5)}`);
await writeFile('dist/sw.js', `
const CACHE = 'question-wizard-proof-${version}';
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('question-wizard-proof-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // All entries are versioned static files. Local preview adds Vary: Origin;
    // module-script requests have a different Origin header from precache fetches.
    const saved = await cache.match(event.request, { ignoreVary: true });
    if (saved) return saved;
    if (event.request.mode === 'navigate') return cache.match('./index.html', { ignoreVary: true });
    return fetch(event.request);
  }));
});
`);
console.log(`Offline cache: ${files.length} local files, version ${version}`);
