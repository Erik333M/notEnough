import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),

  /**
   * Dev default so the project runs with zero setup. A real deployment must set
   * JWT_SECRET; the server refuses to start in production without one.
   */
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  tokenTtl: process.env.TOKEN_TTL ?? '30d',

  dbFile: process.env.DB_FILE ?? path.join(here, '..', 'data', 'db.json'),
  isProduction: process.env.NODE_ENV === 'production',
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}
