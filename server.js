const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple JSON file database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { players: {}, activity: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { players: {}, activity: [] }; }
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// GET /api/player/:uid
app.get('/api/player/:uid', (req, res) => {
  const db = readDB();
  const player = db.players[req.params.uid];
  if (!player) return res.status(404).json({ error: 'UID not found' });
  res.json(player);
});

// POST /api/player — log or update a player
app.post('/api/player', (req, res) => {
  const { uid, name, rank, level, streamer, prevNames, lastSeen } = req.body;
  if (!uid || !name) return res.status(400).json({ error: 'uid and name are required' });

  const db = readDB();
  const now = new Date().toLocaleDateString('en-GB');
  const existing = db.players[uid];

  if (existing) {
    // Name changed — push old name into history
    if (existing.name !== name) {
      existing.names = [
        { name, date: 'Updated ' + now, cur: true },
        ...( existing.names || [{ name: existing.name, date: 'Previous', cur: false }])
          .map(n => ({ ...n, cur: false }))
      ];
      existing.name = name;
      existing.activity = existing.activity || [];
      existing.activity.unshift({ on: true, txt: 'Name changed to ' + name, time: now });
    }
    if (rank) existing.rank = rank;
    if (level) existing.level = level;
    if (streamer) existing.streamer = streamer;
    if (lastSeen) {
      existing.lastSeen = lastSeen;
      existing.activity = existing.activity || [];
      existing.activity.unshift({ on: true, txt: 'Seen: ' + lastSeen, time: now });
    }
    existing.updatedAt = now;
  } else {
    const names = [
      { name, date: 'Logged ' + now, cur: true },
      ...(prevNames || []).map((n, i) => ({ name: n, date: 'Previous name #' + (i + 1), cur: false }))
    ];
    db.players[uid] = {
      uid, name, rank: rank || null, level: level || null,
      streamer: streamer || null, lastSeen: lastSeen || null,
      names, activity: lastSeen ? [{ on: true, txt: 'Logged: ' + lastSeen, time: now }] : [],
      loggedAt: now, updatedAt: now
    };
  }

  writeDB(db);
  res.json({ success: true, player: db.players[uid] });
});

// GET /api/recent — recently updated players
app.get('/api/recent', (req, res) => {
  const db = readDB();
  const players = Object.values(db.players)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 20);
  res.json(players);
});

// GET /api/search?q=name — search by name
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  const db = readDB();
  const results = Object.values(db.players).filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.streamer || '').toLowerCase().includes(q) ||
    (p.names || []).some(n => n.name.toLowerCase().includes(q))
  ).slice(0, 20);
  res.json(results);
});

app.listen(PORT, () => console.log(`TrackUIDS running on port ${PORT}`));
