import { createServer, createMemoryStore } from './app.js';
const url = process.env.DATABASE_URL;
const store = url ? await (await import('./store-pg.js')).createPgStore(url) : createMemoryStore();
if (!url) console.warn('DATABASE_URL not set: using in-memory store');
const port = Number(process.env.PORT || 10000);
createServer(store, { adminToken: process.env.ADMIN_TOKEN }).listen(port, () => console.log(`install-counter on :${port}`));
