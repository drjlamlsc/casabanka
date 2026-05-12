const DB = (() => {
  const NAME = 'CasabankaDB';
  const VERSION = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('homes')) {
          db.createObjectStore('homes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('layouts')) {
          db.createObjectStore('layouts', { keyPath: 'homeId' });
        }
        if (!db.objectStoreNames.contains('items')) {
          const s = db.createObjectStore('items', { keyPath: 'id' });
          s.createIndex('homeId', 'homeId', { unique: false });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function store(name, mode = 'readonly') {
    const db = await open();
    return db.transaction(name, mode).objectStore(name);
  }

  // Homes
  async function getHomes() {
    const s = await store('homes');
    const all = await p(s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }
  async function getHome(id) { return p((await store('homes')).get(id)); }
  async function saveHome(h) { return p((await store('homes', 'readwrite')).put(h)); }
  async function deleteHome(id) {
    await p((await store('homes', 'readwrite')).delete(id));
    await p((await store('layouts', 'readwrite')).delete(id));
    const items = await getItemsByHome(id);
    const s = await store('items', 'readwrite');
    for (const it of items) await p(s.delete(it.id));
  }

  // Layouts
  async function getLayout(homeId) { return p((await store('layouts')).get(homeId)); }
  async function saveLayout(homeId, data) {
    return p((await store('layouts', 'readwrite')).put({ homeId, data, updatedAt: Date.now() }));
  }

  // Items
  async function getItemsByHome(homeId) {
    const db = await open();
    const s = db.transaction('items', 'readonly').objectStore('items');
    return p(s.index('homeId').getAll(homeId));
  }
  async function getItem(id) { return p((await store('items')).get(id)); }
  async function saveItem(item) { return p((await store('items', 'readwrite')).put(item)); }
  async function deleteItem(id) { return p((await store('items', 'readwrite')).delete(id)); }
  async function searchItems(homeId, query) {
    const items = await getItemsByHome(homeId);
    if (!query) return items.sort((a, b) => b.createdAt - a.createdAt);
    const q = query.toLowerCase();
    return items
      .filter(it =>
        (it.name || '').toLowerCase().includes(q) ||
        (it.purpose || '').toLowerCase().includes(q) ||
        (it.notes || '').toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function migrateFromOldDB() {
    if (localStorage.getItem('cb_migrated')) return null;

    // Detect whether HomeInventoryDB actually exists before touching it
    let oldExists = false;
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      oldExists = dbs.some(db => db.name === 'HomeInventoryDB');
    } else {
      oldExists = true; // API unavailable — attempt anyway
    }

    if (!oldExists) {
      localStorage.setItem('cb_migrated', 'true');
      return null;
    }

    return new Promise(resolve => {
      const req = indexedDB.open('HomeInventoryDB');
      let isNew = false;

      req.onupgradeneeded = () => {
        // DB didn't previously exist — abort to avoid creating an empty one
        isNew = true;
        req.transaction.abort();
      };

      req.onerror = () => {
        localStorage.setItem('cb_migrated', 'true');
        resolve(null);
      };

      req.onsuccess = async e => {
        if (isNew) { localStorage.setItem('cb_migrated', 'true'); resolve(null); return; }

        const oldDB = e.target.result;
        const q = r => new Promise((res, rej) => {
          r.onsuccess = () => res(r.result);
          r.onerror  = () => rej(r.error);
        });

        try {
          const homes   = await q(oldDB.transaction('homes').objectStore('homes').getAll());
          const layouts = await q(oldDB.transaction('layouts').objectStore('layouts').getAll());
          const items   = await q(oldDB.transaction('items').objectStore('items').getAll());
          oldDB.close();

          if (!homes.length && !items.length) {
            localStorage.setItem('cb_migrated', 'true');
            resolve(null);
            return;
          }

          await open(); // ensure CasabankaDB is ready
          for (const home   of homes)   await saveHome(home);
          for (const layout of layouts) await p((await store('layouts', 'readwrite')).put(layout));
          for (const item   of items)   await saveItem(item);

          localStorage.setItem('cb_migrated', 'true');
          resolve({ homes: homes.length, layouts: layouts.length, items: items.length });
        } catch (err) {
          oldDB.close();
          resolve(null);
        }
      };
    });
  }

  return { open, getHomes, getHome, saveHome, deleteHome, getLayout, saveLayout,
           getItemsByHome, getItem, saveItem, deleteItem, searchItems, migrateFromOldDB };
})();
