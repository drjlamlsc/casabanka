const GHSync = (() => {
  const BASE      = 'https://api.github.com';
  const FILE_PATH = 'casabanka-data.json';

  // ── Encoding helpers ───────────────────────────────────────────────────────
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 4096) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 4096));
    }
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin   = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ── API wrapper ────────────────────────────────────────────────────────────
  async function api(method, path, token, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization:  `token ${token}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || `GitHub API ${res.status}`);
    }
    return res.json();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async function getOwner(token) {
    const data = await api('GET', '/user', token);
    if (!data) throw new Error('Invalid token or network error');
    return data.login;
  }

  async function load(token, owner, repo) {
    const data = await api('GET', `/repos/${owner}/${repo}/contents/${FILE_PATH}`, token);
    if (!data) return null;   // file doesn't exist yet
    try {
      return {
        content: JSON.parse(fromBase64(data.content)),
        sha: data.sha,
      };
    } catch {
      return null;
    }
  }

  async function save(token, owner, repo, payload, sha) {
    const ts   = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const body = {
      message: `casabanka sync · ${ts}`,
      content: toBase64(JSON.stringify(payload)),
      ...(sha ? { sha } : {}),
    };
    const data = await api('PUT', `/repos/${owner}/${repo}/contents/${FILE_PATH}`, token, body);
    return data?.content?.sha || null;
  }

  return { getOwner, load, save };
})();
