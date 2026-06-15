const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
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

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map userId -> Set of WebSocket clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  try {
    const user = jwt.verify(token, SECRET);
    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);
    ws.on('close', () => clients.get(user.id)?.delete(ws));
  } catch {
    ws.close();
  }
});

// Broadcast helper — attach to app so routes can use it
app.broadcast = (userId, msg) => {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(msg);
  sockets.forEach(ws => ws.readyState === ws.OPEN && ws.send(data));
};

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Tasker running on http://localhost:${PORT}`));
