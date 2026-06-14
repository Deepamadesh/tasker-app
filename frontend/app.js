const API = "http://localhost:3001/api";
let token = localStorage.getItem("token");
let currentUser = null;
let tasks = [];
let activeFilter = "all";
let searchDebounce = null;
let ws = null;

// ── API helper ────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast${type ? " " + type : ""}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2800);
}

// ── WebSocket ─────────────────────────────────────────────
function connectWS() {
  if (ws) ws.close();
  ws = new WebSocket(`ws://localhost:3001?token=${token}`);

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === "task_created") {
      tasks.unshift(msg.task);
      toast("New task added", "success");
    } else if (msg.type === "task_updated") {
      const i = tasks.findIndex((t) => t.id === msg.task.id);
      if (i !== -1) tasks[i] = msg.task;
    } else if (msg.type === "task_deleted") {
      tasks = tasks.filter((t) => t.id !== msg.id);
    }
    renderTasks();
    updateStats();
  };

  ws.onclose = () => {
    if (token) setTimeout(connectWS, 3000);
  };
}

// ── Landing ───────────────────────────────────────────────
function showLanding() {
  document.getElementById("landing-screen").classList.remove("hidden");
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

function goToAuth(tab = "login") {
  document.getElementById("landing-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add("active");
  document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
}

document.getElementById("land-login-btn").addEventListener("click", () => goToAuth("login"));
document.getElementById("land-register-btn").addEventListener("click", () => goToAuth("register"));
document.getElementById("land-signup-btn").addEventListener("click", () => goToAuth("register"));
document.getElementById("land-demo-btn").addEventListener("click", () => goToAuth("login"));

// ── Auth ──────────────────────────────────────────────────
function showAuth() {
  document.getElementById("landing-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  loadTasks();
  loadStats();
  connectWS();
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    document.getElementById("login-form").classList.toggle("hidden", !isLogin);
    document.getElementById("register-form").classList.toggle("hidden", isLogin);
  });
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");
  try {
    const data = await api("/login", {
      method: "POST",
      body: {
        username: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      },
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem("token", token);
    setUserUI();
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  errEl.classList.add("hidden");
  try {
    const data = await api("/register", {
      method: "POST",
      body: {
        username: document.getElementById("reg-username").value,
        password: document.getElementById("reg-password").value,
      },
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem("token", token);
    setUserUI();
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  token = null;
  currentUser = null;
  tasks = [];
  localStorage.removeItem("token");
  if (ws) ws.close();
  showLanding();
});

function setUserUI() {
  if (!currentUser) return;
  document.getElementById("user-name").textContent = currentUser.username;
  document.getElementById("user-email").textContent = `@${currentUser.username}`;
  document.getElementById("user-avatar").textContent = currentUser.username[0].toUpperCase();
}

// ── Tasks ─────────────────────────────────────────────────
async function loadTasks() {
  const params = new URLSearchParams();
  if (activeFilter !== "all") params.set("status", activeFilter);
  const priority = document.getElementById("priority-filter").value;
  if (priority) params.set("priority", priority);
  const search = document.getElementById("search-input").value.trim();
  if (search) params.set("search", search);

  try {
    tasks = await api(`/tasks?${params}`);
    renderTasks();
  } catch {
    toast("Failed to load tasks", "error");
  }
}

async function loadStats() {
  try {
    const s = await api("/tasks/stats");
    document.getElementById("stat-total").textContent = s.total;
    document.getElementById("stat-todo").textContent = s.todo;
    document.getElementById("stat-inprogress").textContent = s.in_progress;
    document.getElementById("stat-done").textContent = s.done;
    document.getElementById("badge-all").textContent = s.total;
    document.getElementById("badge-todo").textContent = s.todo;
    document.getElementById("badge-inprogress").textContent = s.in_progress;
    document.getElementById("badge-done").textContent = s.done;
  } catch {}
}

function updateStats() {
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-todo").textContent = todo;
  document.getElementById("stat-inprogress").textContent = inProgress;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("badge-all").textContent = total;
  document.getElementById("badge-todo").textContent = todo;
  document.getElementById("badge-inprogress").textContent = inProgress;
  document.getElementById("badge-done").textContent = done;
}

function renderTasks() {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";

  const filtered =
    activeFilter === "all"
      ? tasks
      : tasks.filter((t) => t.status === activeFilter);

  if (!filtered.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = "task-card";
    card.dataset.id = task.id;

    const isDone = task.status === "done";
    const isOverdue =
      task.due_date &&
      new Date(task.due_date) < new Date() &&
      !isDone;

    card.classList.add(`priority-${task.priority}`);
    card.innerHTML = `
      <div class="task-check ${isDone ? "done" : ""}" data-id="${task.id}" title="Toggle done"></div>
      <div class="task-body">
        <div class="task-title ${isDone ? "done-text" : ""}">${escHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ""}
        <div class="task-meta">
          <span class="chip chip-status-${task.status}">${task.status}</span>
          <span class="chip chip-priority-${task.priority}">${task.priority}</span>
          ${task.due_date ? `<span class="task-due ${isOverdue ? "overdue" : ""}">📅 ${formatDate(task.due_date)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon edit-btn" data-id="${task.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete-btn" data-id="${task.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Task list events (delegation) ─────────────────────────
document.getElementById("task-list").addEventListener("click", async (e) => {
  const check = e.target.closest(".task-check");
  const editBtn = e.target.closest(".edit-btn");
  const deleteBtn = e.target.closest(".delete-btn");

  if (check) {
    const task = tasks.find((t) => t.id === Number(check.dataset.id));
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    await updateTask(task.id, { status: newStatus });
    return;
  }

  if (editBtn) {
    const task = tasks.find((t) => t.id === Number(editBtn.dataset.id));
    if (task) openModal(task);
    return;
  }

  if (deleteBtn) {
    if (!confirm("Delete this task?")) return;
    await deleteTask(Number(deleteBtn.dataset.id));
  }
});

// ── CRUD ──────────────────────────────────────────────────
async function createTask(data) {
  try {
    await api("/tasks", { method: "POST", body: data });
    toast("Task created!", "success");
    await loadTasks();
    await loadStats();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function updateTask(id, data) {
  try {
    const updated = await api(`/tasks/${id}`, { method: "PUT", body: data });
    const i = tasks.findIndex((t) => t.id === id);
    if (i !== -1) tasks[i] = updated;
    renderTasks();
    await loadStats();
    toast("Task updated!", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteTask(id) {
  try {
    await api(`/tasks/${id}`, { method: "DELETE" });
    tasks = tasks.filter((t) => t.id !== id);
    renderTasks();
    await loadStats();
    toast("Task deleted");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ── Modal ─────────────────────────────────────────────────
function openModal(task = null) {
  document.getElementById("modal-title").textContent = task ? "Edit Task" : "New Task";
  document.getElementById("save-task-btn").textContent = task ? "Save Changes" : "Create Task";
  document.getElementById("task-id").value = task?.id || "";
  document.getElementById("task-title").value = task?.title || "";
  document.getElementById("task-description").value = task?.description || "";
  document.getElementById("task-status").value = task?.status || "todo";
  document.getElementById("task-priority").value = task?.priority || "medium";
  document.getElementById("task-due").value = task?.due_date || "";
  document.getElementById("task-error").classList.add("hidden");
  document.getElementById("task-modal").classList.remove("hidden");
  document.getElementById("task-title").focus();
}

function closeModal() {
  document.getElementById("task-modal").classList.add("hidden");
}

document.getElementById("new-task-btn").addEventListener("click", () => openModal());
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("cancel-modal").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", closeModal);

document.getElementById("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("task-error");
  errEl.classList.add("hidden");

  const data = {
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-description").value.trim(),
    status: document.getElementById("task-status").value,
    priority: document.getElementById("task-priority").value,
    due_date: document.getElementById("task-due").value || null,
  };

  const id = document.getElementById("task-id").value;
  try {
    if (id) {
      await updateTask(Number(id), data);
    } else {
      await createTask(data);
    }
    closeModal();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

// ── Filters ───────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    item.classList.add("active");
    activeFilter = item.dataset.filter;
    const titles = { all: "All Tasks", todo: "To Do", "in-progress": "In Progress", done: "Done" };
    document.getElementById("page-title").textContent = titles[activeFilter];
    loadTasks();
    // close sidebar on mobile
    document.querySelector(".sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("visible");
  });
});

document.getElementById("priority-filter").addEventListener("change", loadTasks);

document.getElementById("search-input").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadTasks, 350);
});

// ── Mobile sidebar toggle ─────────────────────────────────
document.getElementById("menu-toggle").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("visible");
});

document.getElementById("sidebar-overlay").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("visible");
});

// ── Dark mode ─────────────────────────────────────────────
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
updateThemeUI(savedTheme);

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeUI(next);
});

function updateThemeUI(theme) {
  const isDark = theme === "dark";
  document.getElementById("theme-icon-moon").style.display = isDark ? "none" : "block";
  document.getElementById("theme-icon-sun").style.display = isDark ? "block" : "none";
  document.getElementById("theme-label").textContent = isDark ? "Light Mode" : "Dark Mode";
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!token) return showLanding();
  try {
    currentUser = await api("/me");
    setUserUI();
    showApp();
  } catch {
    localStorage.removeItem("token");
    token = null;
    showLanding();
  }
}

init();
