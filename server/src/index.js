import cors from 'cors';
import express from 'express';
import os from 'node:os';

import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { stateRouter } from './routes/state.js';
import { ValidationError } from './validate.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
app.use('/api/state', stateRouter);

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
