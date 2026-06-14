const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { WebSocketServer } = require("ws");
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "tasker.db");
const JWT_SECRET = "tasker_jwt_secret_key_2024";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json());
app.use(express.static(require("path").join(__dirname, "../frontend")));

// ── DB helpers ────────────────────────────────────────────
let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  saveDb();
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  const id = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
  return { lastInsertRowid: id };
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── WebSocket ─────────────────────────────────────────────
function broadcast(userId, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.userId === userId) {
      client.send(JSON.stringify(payload));
    }
  });
}

wss.on("connection", (ws, req) => {
  const token = new URL(req.url, "http://x").searchParams.get("token");
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    ws.userId = id;
  } catch {
    ws.close();
  }
});

// ── Auth middleware ───────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── Auth routes ───────────────────────────────────────────
app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields required" });

  const existing = dbGet("SELECT id FROM users WHERE email=? OR username=?", [email, username]);
  if (existing) return res.status(409).json({ error: "Username or email already exists" });

  const hash = bcrypt.hashSync(password, 10);
  const result = dbRun(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hash]
  );
  const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: result.lastInsertRowid, username, email } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = dbGet("SELECT * FROM users WHERE email=?", [email]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

app.get("/api/me", auth, (req, res) => {
  const user = dbGet("SELECT id, username, email, created_at FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// ── Task routes ───────────────────────────────────────────
app.get("/api/tasks", auth, (req, res) => {
  const { status, priority, search } = req.query;
  let query = "SELECT * FROM tasks WHERE user_id=?";
  const params = [req.user.id];

  if (status) { query += " AND status=?"; params.push(status); }
  if (priority) { query += " AND priority=?"; params.push(priority); }
  if (search) {
    query += " AND (title LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  query += " ORDER BY created_at DESC";
  res.json(dbAll(query, params));
});

app.post("/api/tasks", auth, (req, res) => {
  const { title, description = "", status = "todo", priority = "medium", due_date } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });

  const result = dbRun(
    "INSERT INTO tasks (user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
    [req.user.id, title, description, status, priority, due_date || null]
  );
  const task = dbGet("SELECT * FROM tasks WHERE id=?", [result.lastInsertRowid]);
  broadcast(req.user.id, { type: "task_created", task });
  res.status(201).json(task);
});

app.put("/api/tasks/:id", auth, (req, res) => {
  const task = dbGet("SELECT * FROM tasks WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const { title, description, status, priority, due_date } = req.body;
  dbRun(
    `UPDATE tasks SET
      title=COALESCE(?,title),
      description=COALESCE(?,description),
      status=COALESCE(?,status),
      priority=COALESCE(?,priority),
      due_date=COALESCE(?,due_date),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [title ?? null, description ?? null, status ?? null, priority ?? null, due_date ?? null, req.params.id]
  );
  const updated = dbGet("SELECT * FROM tasks WHERE id=?", [req.params.id]);
  broadcast(req.user.id, { type: "task_updated", task: updated });
  res.json(updated);
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  const task = dbGet("SELECT * FROM tasks WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: "Task not found" });

  dbRun("DELETE FROM tasks WHERE id=?", [req.params.id]);
  broadcast(req.user.id, { type: "task_deleted", id: Number(req.params.id) });
  res.json({ message: "Deleted" });
});

app.get("/api/tasks/stats", auth, (req, res) => {
  const tasks = dbAll("SELECT status, priority FROM tasks WHERE user_id=?", [req.user.id]);
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    high_priority: tasks.filter((t) => t.priority === "high").length,
  };
  res.json(stats);
});

// ── Start ─────────────────────────────────────────────────
initDb().then(() => {
  server.listen(3001, () => console.log("✅ Tasker API running at http://localhost:3001"));
});
