const ROOMS = {
  muse: { name: 'ミューズ', ini: 'M', color: '#8b5cf6' },
  grokbot: { name: 'Grok Bot', ini: 'G', color: '#1f2937' },
  claude: { name: 'Claude', ini: 'C', color: '#d97757' },
  all: { name: 'ふたり同時', ini: '2', color: '#0ea5a4' },
};
const store = { muse: [], grokbot: [], claude: [], all: [] };
const unread = { muse: 0, grokbot: 0, claude: 0, all: 0 };
let cur = 'muse';
let me = 'yang';

const $ = (s) => document.querySelector(s);
const log = $('#log');
const input = $('#input');
const go = $('#go');

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');

function colorOf(name) {
  if (name === 'muse') return ROOMS.muse.color;
  if (name === 'claude') return ROOMS.claude.color;
  if (name === me) return '#2f6df6';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 45%)`;
}

function avatar(name, cls = '') {
  const a = document.createElement('span');
  a.className = 'av ' + cls;
  a.style.background = colorOf(name);
  a.textContent = (name || '?').slice(0, 1).toUpperCase();
  return a;
}

const dateOf = (m) => {
  const d = m.at ? new Date(m.at) : null;
  return d && !isNaN(d) ? d : null;
};
const hm = (d) => (d ? `${d.getHours()}:${pad(d.getMinutes())}` : '');

function dayLabel(d) {
  const now = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, now)) return '今日';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (same(d, y)) return '昨日';
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
}

function buildLog(list) {
  const frag = document.createDocumentFragment();
  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'まだメッセージはありません';
    frag.appendChild(e);
    return frag;
  }
  let lastDay = '';
  let prev = null;
  for (const m of list) {
    const d = dateOf(m);
    const day = d ? d.toDateString() : '';
    if (day && day !== lastDay) {
      const s = document.createElement('div');
      s.className = 'day';
      s.textContent = dayLabel(d);
      frag.appendChild(s);
      lastDay = day;
      prev = null;
    }
    const mine = m.from === me;
    const grouped = prev && prev.from === m.from && d && prev.d && d - prev.d < 3 * 60 * 1000;
    const row = document.createElement('div');
    row.className = 'row' + (mine ? ' me' : '') + (grouped ? '' : ' first');
    if (!mine) row.appendChild(grouped ? avatar(m.from, 'ghost') : avatar(m.from));
    const col = document.createElement('div');
    col.className = 'col';
    if (!mine && !grouped) {
      const n = document.createElement('div');
      n.className = 'nm';
      n.textContent = m.from;
      col.appendChild(n);
    }
    const line = document.createElement('div');
    line.className = 'line';
    const b = document.createElement('div');
    b.className = 'bub';
    b.textContent = m.body;
    const t = document.createElement('span');
    t.className = 'tm';
    t.textContent = hm(d);
    line.append(b, t);
    col.appendChild(line);
    row.appendChild(col);
    frag.appendChild(row);
    prev = { from: m.from, d };
  }
  return frag;
}

function atBottom() {
  return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
}

function render(stick = true) {
  const top = log.scrollTop;
  log.replaceChildren(buildLog(store[cur]));
  log.scrollTop = stick ? log.scrollHeight : top;
}

function sidebar() {
  document.querySelectorAll('.room').forEach((b) => {
    const k = b.dataset.room;
    const av = b.querySelector('.av');
    av.style.background = ROOMS[k].color;
    av.textContent = ROOMS[k].ini;
    const last = store[k][store[k].length - 1];
    b.querySelector('.prev').textContent = last ? last.body.replace(/\s+/g, ' ') : '';
    const d = last && dateOf(last);
    b.querySelector('.time').textContent = d ? (new Date().toDateString() === d.toDateString() ? hm(d) : `${d.getMonth() + 1}/${d.getDate()}`) : '';
    const bd = b.querySelector('.badge');
    bd.hidden = !unread[k];
    bd.textContent = unread[k];
    b.classList.toggle('on', k === cur);
  });
  const h = $('#hav');
  h.style.background = ROOMS[cur].color;
  h.textContent = ROOMS[cur].ini;
  $('#title').textContent = ROOMS[cur].name;
}

function addMessages(list, initial) {
  let touched = false;
  for (const m of list) {
    if (!store[m.room]) continue;
    if (store[m.room].some((x) => x.path === m.path)) continue;
    store[m.room].push(m);
    store[m.room].sort((a, b) => a.sort.localeCompare(b.sort));
    if (m.room === cur) touched = true;
    else if (!initial && m.from !== me) unread[m.room]++;
  }
  if (touched) render(atBottom() || initial || list.some((m) => m.from === me));
  sidebar();
}

document.querySelectorAll('.room').forEach((b) =>
  b.addEventListener('click', () => {
    cur = b.dataset.room;
    unread[cur] = 0;
    render();
    sidebar();
    input.focus();
  })
);

function fit() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  go.disabled = !input.value.trim();
}
input.addEventListener('input', fit);

async function send() {
  const body = input.value.trim();
  if (!body) return;
  input.value = '';
  fit();
  try {
    await window.api.send({ room: cur, to: cur, body });
  } catch (e) {
    input.value = body;
    fit();
    setStatus({ state: 'error', detail: e.message });
  }
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  send();
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    send();
  }
});

function setStatus({ state, detail }) {
  const s = $('#status');
  s.className = state === 'error' ? 'err' : 'ok';
  s.textContent = state === 'ok' ? '同期中' : detail || 'エラー';
}

window.api.onMessages(({ messages, initial }) => addMessages(messages, initial));
window.api.onStatus(setStatus);
window.api.onReset(() => {
  for (const k of Object.keys(store)) {
    store[k] = [];
    unread[k] = 0;
  }
  render();
  sidebar();
});

const dlg = $('#dlg');
$('#gear').addEventListener('click', async () => {
  const c = await window.api.getCfg();
  $('#cRepo').value = c.repo;
  $('#cBranch').value = c.branch;
  $('#cMe').value = c.me;
  $('#cToken').value = '';
  dlg.showModal();
});
$('#cCancel').addEventListener('click', () => dlg.close());
$('#cfgForm').addEventListener('submit', async () => {
  try {
    await window.api.setCfg({ repo: $('#cRepo').value, branch: $('#cBranch').value, me: $('#cMe').value, token: $('#cToken').value });
    me = $('#cMe').value.trim() || me;
  } catch (e) {
    setStatus({ state: 'error', detail: e.message });
  }
});

window.api.getCfg().then((c) => {
  me = c.me;
  render();
});
render();
sidebar();
input.focus();
