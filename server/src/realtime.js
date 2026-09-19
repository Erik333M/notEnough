import { WebSocketServer } from 'ws';

import { userFromToken } from './auth.js';
import { read } from './db.js';
import { canViewEvent } from './permissions.js';

/**
 * Live delivery for event chat.
 *
 * A message is written by the ordinary REST route — that is what makes it
 * durable, and what applies the permission rules. This only pushes it out, so
 * a client with no socket loses liveness and nothing else: the history
 * endpoint still returns everything.
 *
 * ── Why the token is not in the URL ─────────────────────────────────────────
 *
 * A browser cannot set headers on a WebSocket, so the usual trick is
 * `?token=...`. That puts a thirty-day credential into the request line, which
 * is the one part of a request that ends up in access logs, proxy logs and
 * crash reports. So a socket connects unauthenticated and must send an `auth`
 * frame as its first message; anything else and it is closed. The token then
 * lives only in a frame body, which nothing logs.
 */

/** Sockets that never identify themselves are not worth holding open. */
const AUTH_GRACE_MS = 10000;

/** @type {Set<{socket: import('ws').WebSocket, userId: string, rooms: Set<string>}>} */
const clients = new Set();

const send = (socket, payload) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
};

/**
 * Push a message to everybody watching that event.
 *
 * Membership was checked when they subscribed, and again here — a socket that
 * was subscribed before somebody was removed from a camp must not keep
 * receiving it, and sockets outlive memberships.
 */
export async function broadcastMessage(eventId, message) {
  const listening = [...clients].filter((client) => client.rooms.has(eventId));
  if (listening.length === 0) return;

  const data = await read();
  const event = data.events.find((row) => row.id === eventId);

  for (const client of listening) {
    if (!canViewEvent(data, client.userId, event)) {
      client.rooms.delete(eventId);
      continue;
    }
    send(client.socket, { type: 'message', eventId, message });
  }
}

/** Ephemeral, never stored: who is typing, to everybody else in the room. */
function relayTyping(from, eventId, name) {
  for (const client of clients) {
    if (client === from || !client.rooms.has(eventId)) continue;
    send(client.socket, { type: 'typing', eventId, userId: from.userId, name });
  }
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    /** @type {{socket: import('ws').WebSocket, userId: string, rooms: Set<string>} | null} */
    let client = null;
    let name = '';

    const timer = setTimeout(() => {
      if (!client) socket.close(4001, 'No auth');
    }, AUTH_GRACE_MS);

    socket.on('message', async (raw) => {
      let frame = null;
      try {
        frame = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (frame?.type === 'auth') {
        if (client) return;
        const user = await userFromToken(frame.token);
        if (!user) {
          socket.close(4001, 'Bad token');
          return;
        }
        clearTimeout(timer);
        name = user.name;
        client = { socket, userId: user.id, rooms: new Set() };
        clients.add(client);
        send(socket, { type: 'ready' });
        return;
      }

      // Everything past this point needs a known user.
      if (!client) return;

      if (frame?.type === 'subscribe' && typeof frame.eventId === 'string') {
        const data = await read();
        const event = data.events.find((row) => row.id === frame.eventId);
        if (!canViewEvent(data, client.userId, event)) {
          send(socket, { type: 'denied', eventId: frame.eventId });
          return;
        }
        client.rooms.add(frame.eventId);
        send(socket, { type: 'subscribed', eventId: frame.eventId });
        return;
      }

      if (frame?.type === 'unsubscribe' && typeof frame.eventId === 'string') {
        client.rooms.delete(frame.eventId);
        return;
      }

      if (frame?.type === 'typing' && typeof frame.eventId === 'string') {
        if (client.rooms.has(frame.eventId)) relayTyping(client, frame.eventId, name);
      }
    });

    socket.on('close', () => {
      clearTimeout(timer);
      if (client) clients.delete(client);
    });

    // A socket error is a dead socket; dropping it is the whole response.
    socket.on('error', () => {
      clearTimeout(timer);
      if (client) clients.delete(client);
    });
  });

  return wss;
}
