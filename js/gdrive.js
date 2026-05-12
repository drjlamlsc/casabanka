const GDrive = (() => {
  const SCOPE     = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME = 'casabanka-data.json';
  const API       = 'https://www.googleapis.com/drive/v3';
  const UPLOAD    = 'https://www.googleapis.com/upload/drive/v3';

  let tokenClient = null;
  let accessToken = null;
  let cachedFileId = null;

  // ── Setup ──────────────────────────────────────────────────────────────────
  function setup(clientId) {
    if (!window.google?.accounts?.oauth2) return false;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {},   // overridden per-call
    });
    return true;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  // prompt=''            → silent if already granted, popup if not
  // prompt='select_account' → always show account picker (first connect)
  function requestToken(prompt = '') {
    return new Promise((resolve, reject) => {
      tokenClient.callback = resp => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
        } else {
          accessToken = resp.access_token;
          resolve(accessToken);
        }
      };
      tokenClient.requestAccessToken({ prompt });
    });
  }

  async function ensureToken() {
    if (accessToken) return;
    await requestToken('');
  }

  // ── Low-level fetch ────────────────────────────────────────────────────────
  async function driveRequest(method, path, body, isUpload = false) {
    await ensureToken();
    const base = isUpload ? UPLOAD : API;
    const opts = {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    if (body instanceof FormData) {
      opts.body = body;
    } else if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(base + path, opts);
    if (res.status === 401) { accessToken = null; throw new Error('auth_expired'); }
    if (res.status === 204 || res.status === 200 && res.headers.get('content-length') === '0') return null;
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `Drive ${res.status}`);
    }
    return res.json();
  }

  // ── File helpers ───────────────────────────────────────────────────────────
  async function findFile() {
    if (cachedFileId) return cachedFileId;
    const data = await driveRequest(
      'GET',
      `/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)&pageSize=1`
    );
    cachedFileId = data?.files?.[0]?.id || null;
    return cachedFileId;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async function load() {
    const id = await findFile();
    if (!id) return null;
    await ensureToken();
    const res = await fetch(`${API}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function save(payload) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const id = await findFile();

    if (id) {
      // Update existing file content
      const form = new FormData();
      form.append('metadata', new Blob(['{}'], { type: 'application/json' }));
      form.append('file', blob);
      await driveRequest('PATCH', `/files/${id}?uploadType=multipart`, form, true);
    } else {
      // Create new file in appDataFolder
      const meta = { name: FILE_NAME, parents: ['appDataFolder'] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', blob);
      const result = await driveRequest('POST', '/files?uploadType=multipart', form, true);
      cachedFileId = result?.id || null;
    }
  }

  function signOut() {
    if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
    cachedFileId = null;
    tokenClient = null;
  }

  return { setup, requestToken, ensureToken, load, save, signOut };
})();
