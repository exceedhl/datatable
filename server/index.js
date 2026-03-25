import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import cors from 'cors';
import { seedDb } from './seed.js';
import { getDb, initDb } from './db.js';

const PORT = 3001;
const app = express();
app.use(cors());
app.use(express.json());

// --- State Management ---
const rooms = new Map(); // roomId -> { ydoc, conns: Set<ws>, lastIdleTime }

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      ydoc: new Y.Doc(),
      conns: new Set(),
      lastIdleTime: null,
    });
  }
  return rooms.get(roomId);
}

// --- Init ---
await initDb();
await seedDb();
const db = await getDb();

// Load initial data from DB into a YDoc
async function loadRoomData(roomId) {
  const room = getOrCreateRoom(roomId);

  // Try hot snapshot first
  const snapshot = await db.get('SELECT yjs_blob FROM room_snapshots WHERE room_id = ?', [roomId]);
  if (snapshot && snapshot.yjs_blob) {
    Y.applyUpdate(room.ydoc, new Uint8Array(snapshot.yjs_blob));
    console.log(`Restored hot snapshot for room: ${roomId}`);
    return room;
  }

  // Otherwise load from flat records
  const records = await db.all('SELECT * FROM records');
  const ymap = room.ydoc.getMap('data');
  room.ydoc.transact(() => {
    records.forEach((r) => {
      const dataObj = JSON.parse(r.data);
      const rowMap = new Y.Map();
      for (const [k, v] of Object.entries(dataObj)) {
        rowMap.set(k, v);
      }
      ymap.set(r.row_id, rowMap);
    });
  });
  console.log(`Initialized room ${roomId} from ${records.length} flat records.`);
  return room;
}

// --- Health API ---
app.get('/api/health', (_req, res) => res.send('OK'));

// --- WebSocket Server ---
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const match = request.url?.match(/^\/api\/sandbox-ws\/([^?]+)/);
  if (!match) {
    socket.destroy();
    return;
  }

  const roomId = match[1];
  const room = rooms.has(roomId) ? rooms.get(roomId) : await loadRoomData(roomId);

  wss.handleUpgrade(request, socket, head, (ws) => {
    // Add connection
    room.conns.add(ws);
    room.lastIdleTime = null;
    console.log(`Client joined room: ${roomId} (${room.conns.size} clients)`);

    // Send initial state
    const stateVector = Y.encodeStateAsUpdate(room.ydoc);
    ws.send(stateVector);

    // Handle incoming updates from this client
    ws.on('message', (message) => {
      try {
        const update = new Uint8Array(message);
        Y.applyUpdate(room.ydoc, update);

        // Broadcast to all other clients in the same room
        for (const conn of room.conns) {
          if (conn !== ws && conn.readyState === 1) {
            conn.send(update);
          }
        }
      } catch (err) {
        console.error('Error applying update:', err);
      }
    });

    ws.on('close', () => {
      room.conns.delete(ws);
      console.log(`Client left room: ${roomId} (${room.conns.size} clients)`);
    });
  });
});

// --- DT-D2: Hot Backup & Cold Archive Timer ---
setInterval(async () => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    // 1. Hot Backup: binary snapshot -> DB
    const stateUpdate = Y.encodeStateAsUpdate(room.ydoc);
    await db.run(
      `INSERT INTO room_snapshots (room_id, yjs_blob, last_updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(room_id)
       DO UPDATE SET yjs_blob=excluded.yjs_blob, last_updated_at=CURRENT_TIMESTAMP`,
      [roomId, Buffer.from(stateUpdate)]
    );
    console.log(`[Hot Backup] room=${roomId}`);

    // 2. Cold Archive check
    if (room.conns.size === 0) {
      if (!room.lastIdleTime) {
        room.lastIdleTime = now;
      } else if (now - room.lastIdleTime > 5 * 60 * 1000) {
        console.log(`[Cold Archive] Triggered for room=${roomId}`);
        const ymap = room.ydoc.getMap('data');
        const flatData = ymap.toJSON();

        const stmt = await db.prepare(
          `INSERT INTO records (row_id, data, last_updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(row_id)
           DO UPDATE SET data=excluded.data, last_updated_at=CURRENT_TIMESTAMP`
        );
        for (const [key, val] of Object.entries(flatData)) {
          await stmt.run(key, JSON.stringify(val));
        }
        await stmt.finalize();
        console.log(`[Cold Archive] Archived ${Object.keys(flatData).length} records.`);

        // Cleanup memory
        room.ydoc.destroy();
        rooms.delete(roomId);
      }
    } else {
      room.lastIdleTime = null;
    }
  }
}, 60_000);

server.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});
