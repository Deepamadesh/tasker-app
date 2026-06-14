const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware');

router.use(auth);

router.get('/', async (req, res) => {
  const tasks = await db.qAll('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
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
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const task = await db.qGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  await db.qRun('DELETE FROM tasks WHERE id = ?', [task.id]);
  res.json({ success: true });
});

module.exports = router;
