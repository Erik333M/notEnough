import cors from 'cors';
import express from 'express';
import os from 'node:os';

import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { avatarsRouter } from './routes/avatars.js';
import { stateRouter } from './routes/state.js';
import { challengesRouter } from './routes/challenges.js';
import { eventTeamsRouter } from './routes/event-teams.js';
import { eventsRouter } from './routes/events.js';
import { friendsRouter } from './routes/friends.js';
import { profilesRouter } from './routes/profiles.js';
import { sessionActionsRouter } from './routes/session-actions.js';
import { sharesRouter } from './routes/shares.js';
import { sessionsRouter } from './routes/sessions.js';
import { teamMembersRouter } from './routes/team-members.js';
import { teamsRouter } from './routes/teams.js';
import { workRouter } from './routes/work.js';
import { ValidationError } from './validate.js';

const app = express();

app.use(cors());
// 1mb was fine for state blobs; an avatar arrives base64-encoded, which
// inflates it by a third, so the ceiling has to clear the store's own limit.
app.use(express.json({ limit: '2mb' }));

// One-line request log — enough to debug a device that will not sync, without
// pulling in a logging framework.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'notenough-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/avatars', avatarsRouter);
app.use('/api/state', stateRouter);
app.use('/api/teams', teamsRouter);
// Membership verbs live in their own file for length; same path, same rules.
app.use('/api/teams', teamMembersRouter);
app.use('/api/teams', sharesRouter);
// Team-scoped creation and listing share the /api/teams path; acting on one
// challenge is addressed by its own id under /detail.
app.use('/api/teams', challengesRouter);
app.use('/api/events', eventsRouter);
// Squads inside an event; same path, split for length.
app.use('/api/events', eventTeamsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/friends', profilesRouter);
// Two routers, one path: session-actions holds the verbs (hand out, start from
// template) that would have pushed the sessions file past a readable size.
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions', sessionActionsRouter);
app.use('/api/work', workRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'No such endpoint.' });
});

// Central error handler: validation failures become field-tagged 400s, and
// nothing else leaks a stack trace to the client.
app.use((error, _req, res, _next) => {
  if (error instanceof ValidationError) {
    return res.status(error.status).json({
      error: 'validation_error',
      field: error.field,
      message: error.message,
    });
  }
  console.error('Unhandled error:', error);
  return res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
});

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\nNOTenough API listening on port ${config.port}`);
  console.log(`  local:   http://localhost:${config.port}/api/health`);
  for (const address of localAddresses()) {
    console.log(`  device:  http://${address}:${config.port}/api/health`);
  }
  console.log(`  data:    ${config.dbFile}\n`);
});
