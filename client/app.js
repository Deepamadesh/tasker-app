const API = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

let token = localStorage.getItem('token') || null;
let username = localStorage.getItem('username') || null;
let tasks = [];
let editingId = null;
let deletingId = null;
let ws = null;
let authMode = 'login';

// ─── Auth ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    authMode = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('auth-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-error').classList.add('hidden');
  });
});

document.getElementById('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const uname = document.getElementById('auth-username').value.trim();
  const pwd = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  try {
    const res = await fetch(`${API}/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
    token = data.token; username = data.username;
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    showApp();
  } catch {
    errEl.textContent = 'Connection error'; errEl.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  token = null; username = null; tasks = [];
  localStorage.removeItem('token'); localStorage.removeItem('username');
  ws?.close();
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
});

// ─── App Init ────────────────────────────────────────────────────────────────
function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('welcome-msg').textContent = `Hi, ${username}`;
  loadTasks();
  connectWS();
}

async function loadTasks() {
  const res = await fetch(`${API}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { document.getElementById('logout-btn').click(); return; }
  tasks = await res.json();
  renderBoard();
}

// ─── WebSocket ───────────────────────────────────────────────────────────────
function connectWS() {
  ws = new WebSocket(`${WS_URL}?token=${token}`);
  ws.onmessage = ({ data }) => {
    const { event, task } = JSON.parse(data);
    if (event === 'created') tasks.unshift(task);
    else if (event === 'updated') tasks = tasks.map(t => t.id === task.id ? task : t);
    else if (event === 'deleted') tasks = tasks.filter(t => t.id !== task.id);
    renderBoard();
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function getFiltered() {
  const st = document.getElementById('filter-status').value;
  const pr = document.getElementById('filter-priority').value;
  return tasks.filter(t => (!st || t.status === st) && (!pr || t.priority === pr));
}

function renderBoard() {
  const filtered = getFiltered();
  ['todo', 'in-progress', 'done'].forEach(status => {
    const list = document.getElementById(`list-${status}`);
    const group = filtered.filter(t => t.status === status);
    document.getElementById(`count-${status}`).textContent = group.length;
    list.innerHTML = group.map(taskCard).join('');
  });
  document.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openEdit(+btn.dataset.id)));
  document.querySelectorAll('.del-btn').forEach(btn =>
    btn.addEventListener('click', () => openConfirm(+btn.dataset.id)));
}

function taskCard(t) {
  const today = new Date().toISOString().split('T')[0];
  const overdue = t.due_date && t.due_date < today && t.status !== 'done';
  const due = t.due_date ? `<span class="due-date${overdue ? ' overdue' : ''}">${overdue ? '⚠ ' : ''}${t.due_date}</span>` : '';
  return `
    <div class="task-card" data-priority="${t.priority}">
      <div class="task-title">${esc(t.title)}</div>
      ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
      <div class="task-meta">
        <span class="badge ${t.priority}">${t.priority}</span>
        ${due}
        <div class="card-actions">
          <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
          <button class="del-btn" data-id="${t.id}" title="Delete">🗑️</button>
        </div>
      </div>
    </div>`;
}

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

document.getElementById('filter-status').addEventListener('change', renderBoard);
document.getElementById('filter-priority').addEventListener('change', renderBoard);

// ─── Task Modal ───────────────────────────────────────────────────────────────
document.getElementById('new-task-btn').addEventListener('click', () => openModal());
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('task-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

function openModal(task = null) {
  editingId = task?.id ?? null;
  document.getElementById('modal-title').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('task-title').value = task?.title ?? '';
  document.getElementById('task-desc').value = task?.description ?? '';
  document.getElementById('task-status').value = task?.status ?? 'todo';
  document.getElementById('task-priority').value = task?.priority ?? 'medium';
  document.getElementById('task-due').value = task?.due_date ?? '';
  document.getElementById('task-error').classList.add('hidden');
  document.getElementById('task-modal').classList.remove('hidden');
  document.getElementById('task-title').focus();
}

function closeModal() {
  document.getElementById('task-modal').classList.add('hidden');
  editingId = null;
}

function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (task) openModal(task);
}

document.getElementById('task-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    title: document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-desc').value.trim(),
    status: document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    due_date: document.getElementById('task-due').value || null
  };
  const errEl = document.getElementById('task-error');
  try {
    const url = editingId ? `${API}/tasks/${editingId}` : `${API}/tasks`;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
    // WS will update state; optimistically update if WS is slow
    if (editingId) tasks = tasks.map(t => t.id === data.id ? data : t);
    else if (!tasks.find(t => t.id === data.id)) tasks.unshift(data);
    renderBoard();
    closeModal();
  } catch {
    errEl.textContent = 'Request failed'; errEl.classList.remove('hidden');
  }
});

// ─── Delete Confirm ───────────────────────────────────────────────────────────
document.getElementById('confirm-cancel').addEventListener('click', () => {
  document.getElementById('confirm-modal').classList.add('hidden');
  deletingId = null;
});
document.getElementById('confirm-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) { document.getElementById('confirm-modal').classList.add('hidden'); deletingId = null; }
});

function openConfirm(id) {
  deletingId = id;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

document.getElementById('confirm-ok').addEventListener('click', async () => {
  if (!deletingId) return;
  await fetch(`${API}/tasks/${deletingId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  tasks = tasks.filter(t => t.id !== deletingId);
  renderBoard();
  document.getElementById('confirm-modal').classList.add('hidden');
  deletingId = null;
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
if (token) showApp();
