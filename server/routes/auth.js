const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET } = require('../middleware');

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.qRun('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    const token = jwt.sign({ id: result.lastID, username }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, username } });
  } catch {
    res.status(409).json({ error: 'Username already taken' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.qGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username } });
});

module.exports = router;
