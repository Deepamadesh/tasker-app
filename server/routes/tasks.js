const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware');

router.use(auth);

router.get('/', async (req, res) => {
  const { status, priority, search } = req.query;
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [req.user.id];

  if (status)   { sql += ' AND status = ?';          params.push(status); }
  if (priority) { sql += ' AND priority = ?';         params.push(priority); }
  if (search)   { sql += ' AND title LIKE ?';         params.push(`%${search}%`); }

  sql += ' ORDER BY created_at DESC';
  const tasks = await db.qAll(sql, params);
  res.json(tasks);
});

router.get('/stats', async (req, res) => {
  const tasks = await db.qAll('SELECT status FROM tasks WHERE user_id = ?', [req.user.id]);
  res.json({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  });
});

router.post('/', async (req, res) => {
  const { title, description, status, priority, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const result = await db.qRun(
    'INSERT INTO tasks (user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, title, description || '', status || 'todo', priority || 'medium', due_date || null]
  );
  const task = await db.qGet('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
  req.app.broadcast(req.user.id, { type: 'task_created', task });
  res.status(201).json(task);
});

router.put('/:id', async (req, res) => {
  const task = await db.qGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, status, priority, due_date } = req.body;
  await db.qRun(
    'UPDATE tasks SET title=?, description=?, status=?, priority=?, due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title ?? task.title, description ?? task.description, status ?? task.status, priority ?? task.priority, due_date ?? task.due_date, task.id]
  );
  const updated = await db.qGet('SELECT * FROM tasks WHERE id = ?', [task.id]);
  req.app.broadcast(req.user.id, { type: 'task_updated', task: updated });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const task = await db.qGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  await db.qRun('DELETE FROM tasks WHERE id = ?', [task.id]);
  req.app.broadcast(req.user.id, { type: 'task_deleted', id: task.id });
  res.json({ success: true });
});

module.exports = router;
