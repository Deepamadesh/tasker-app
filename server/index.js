const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { SECRET, auth } = require('./middleware');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

app.use('/api', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

app.get('/api/me', auth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Tasker running on http://localhost:${PORT}`));
