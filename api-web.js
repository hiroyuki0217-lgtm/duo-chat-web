(() => {
  const KEY = 'duochat.cfg';
  const POLL_MS = 5000;
  let cfg = { repo: 'hiroyuki0217-lgtm/ai-chat-bus', branch: 'main', me: 'yang', token: '' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}

  const L = { messages: [], status: [], reset: [] };
  const emit = (k, d) => L[k].forEach((f) => f(d));
  const seen = new Map();
  let etag = null, timer = null, first = true, busy = false;

  const gh = (method, url, body, extra = {}) =>
    fetch('https://api.github.com' + url, {
      method,
      headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });

  const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

  function parse(p, text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta = {};
    let body = text;
    if (m) {
      for (const line of m[1].split(/\r?\n/)) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      body = m[2];
    }
    const parts = p.split('/');
    const file = parts[parts.length - 1];
    return {
      path: p, room: parts[1],
      from: meta.from || file.replace(/\.md$/, '').split('-').slice(1).join('-') || '?',
      to: meta.to || '', at: meta.at || '', sort: file.split('-')[0], body: body.trim(),
    };
  }

  async function poll() {
    if (busy) return;
    if (!cfg.token) return emit('status', { state: 'error', detail: '設定でトークンを入力してください' });
    busy = true;
    try {
      const res = await gh('GET', `/repos/${cfg.repo}/git/trees/${cfg.branch}?recursive=1`, null, etag ? { 'If-None-Match': etag } : {});
      if (res.status === 304 || res.status === 409) return emit('status', { state: 'ok' });
      if (res.status === 401) throw new Error('トークンが無効です');
      if (res.status === 404) throw new Error('リポジトリが見つかりません（トークンの権限を確認）');
      if (!res.ok) throw new Error('GitHub ' + res.status);
      etag = res.headers.get('etag');
      const tree = await res.json();
      const files = (tree.tree || []).filter((t) => t.type === 'blob' && /^rooms\/[^/]+\/.+\.md$/.test(t.path) && !seen.has(t.path));
      const fresh = [];
      await Promise.all(files.map(async (f) => {
        const r = await gh('GET', `/repos/${cfg.repo}/git/blobs/${f.sha}`);
        if (!r.ok) return;
        const m = parse(f.path, b64d((await r.json()).content));
        seen.set(f.path, m);
        fresh.push(m);
      }));
      fresh.sort((a, b) => a.sort.localeCompare(b.sort));
      if (fresh.length) emit('messages', { messages: fresh, initial: first });
      first = false;
      emit('status', { state: 'ok' });
    } catch (e) {
      emit('status', { state: 'error', detail: e.message });
    } finally {
      busy = false;
    }
  }

  function start() {
    clearInterval(timer);
    etag = null; first = true; seen.clear();
    emit('reset');
    poll();
    timer = setInterval(poll, POLL_MS);
  }

  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(), 3)}Z`;
  const jst = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().replace('Z', '+09:00');

  document.addEventListener('visibilitychange', () => { if (!document.hidden) { etag = null; poll(); } });

  window.api = {
    getCfg: async () => ({ repo: cfg.repo, branch: cfg.branch, me: cfg.me, hasToken: !!cfg.token }),
    setCfg: async (n) => {
      cfg.repo = (n.repo || cfg.repo).trim();
      cfg.branch = (n.branch || cfg.branch).trim();
      cfg.me = (n.me || cfg.me).trim();
      if (n.token && n.token.trim()) cfg.token = n.token.trim();
      localStorage.setItem(KEY, JSON.stringify(cfg));
      start();
    },
    send: async ({ room, to, body }) => {
      const now = new Date();
      const p = `rooms/${room}/${stamp(now)}-${cfg.me}.md`;
      const text = `---\nfrom: ${cfg.me}\nto: ${to || room}\nat: ${jst(now)}\n---\n${body.trim()}\n`;
      const res = await gh('PUT', `/repos/${cfg.repo}/contents/${p}`, { message: `chat: ${cfg.me} -> ${to || room}`, content: b64e(text), branch: cfg.branch });
      if (!res.ok) throw new Error('送信失敗 ' + res.status);
      const m = parse(p, text);
      seen.set(p, m);
      emit('messages', { messages: [m], initial: false });
      etag = null;
    },
    onMessages: (cb) => L.messages.push(cb),
    onStatus: (cb) => L.status.push(cb),
    onReset: (cb) => L.reset.push(cb),
    start,
  };
})();
