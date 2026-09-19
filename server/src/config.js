import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  /**
   * Deliberately not 4000: that port is commonly taken by other local dev
   * servers, and a failed bind here surfaces in the app as a CORS error
   * against someone else's service rather than an obvious connection failure.
   * Must match DEFAULT_PORT in src/api/client.ts.
   */
  port: Number(process.env.PORT ?? 4137),

  /**
   * Dev default so the project runs with zero setup. A real deployment must set
   * JWT_SECRET; the server refuses to start in production without one.
   */
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  tokenTtl: process.env.TOKEN_TTL ?? '30d',

  dbFile: process.env.DB_FILE ?? path.join(here, '..', 'data', 'db.json'),

  /**
   * Avatar bytes, beside the database rather than inside it. See
   * avatar-store.js for why they are not a column.
   */
  avatarDir: process.env.AVATAR_DIR ?? path.join(here, '..', 'data', 'avatars'),
  isProduction: process.env.NODE_ENV === 'production',
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}
