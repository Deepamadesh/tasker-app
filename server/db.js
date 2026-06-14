const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tasks.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// Promisified helpers
db.qGet  = (sql, p) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
db.qAll  = (sql, p) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
db.qRun  = (sql, p) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res(this); }));

module.exports = db;
