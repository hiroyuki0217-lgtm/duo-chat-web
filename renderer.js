const NAMES = { muse: 'ミューズ', grokbot: 'Grok Bot', all: 'ふたり同時' };
const store = { muse: [], grokbot: [], all: [] };
const unread = { muse: 0, grokbot: 0, all: 0 };
let cur = 'muse';
let me = 'yang';

const $ = (s) => document.querySelector(s);
const log = $('#log');
const input = $('#input');

function el(msg) {
  const d = document.createElement('div');
  d.className = 'msg' + (msg.from === me ? ' me' : '');
  const w = document.createElement('div');
  w.className = 'who';
  const t = msg.at ? new Date(msg.at) : null;
  const hm = t && !isNaN(t) ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
  w.textContent = `${msg.from}${hm ? ' ・ ' + hm : ''}`;
  const b = document.createElement('div');
  b.textContent = msg.body;
  d.append(w, b);
  return d;
}

function atBottom() {
  return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
}

function render() {
  log.replaceChildren(...store[cur].map(el));
  log.scrollTop = log.scrollHeight;
}

function badges() {
  document.querySelectorAll('.room').forEach((b) => {
    const n = unread[b.dataset.room];
    const bd = b.querySelector('.badge');
    bd.hidden = !n;
    bd.textContent = n;
    b.classList.toggle('on', b.dataset.room === cur);
  });
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
  if (touched) {
    const stick = atBottom() || initial;
    const top = log.scrollTop;
    log.replaceChildren(...store[cur].map(el));
    log.scrollTop = stick ? log.scrollHeight : top;
  }
  badges();
}

document.querySelectorAll('.room').forEach((b) =>
  b.addEventListener('click', () => {
    cur = b.dataset.room;
    unread[cur] = 0;
    $('#title').textContent = NAMES[cur];
    render();
    badges();
    input.focus();
  })
);

async function send() {
  const body = input.value.trim();
  if (!body) return;
  input.value = '';
  try {
    await window.api.send({ room: cur, to: cur, body });
  } catch (e) {
    input.value = body;
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
  s.className = state === 'error' ? 'err' : '';
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
  badges();
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
});
input.focus();
