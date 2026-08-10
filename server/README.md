# NOTenough API

Small Express service backing the [NOTenough](../README.md) mobile app. Accounts and per-user state
persist to a single JSON file — no database to install.

```bash
npm install
npm start      # http://localhost:4000
npm run dev    # same, with --watch
npm run smoke  # 22 end-to-end checks against a running server
```

## Configuration

All values have working dev defaults; see [.env.example](.env.example).

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | The app assumes this unless `EXPO_PUBLIC_API_URL` is set. |
| `JWT_SECRET` | dev placeholder | **Required** when `NODE_ENV=production` — the server refuses to boot without it. |
| `TOKEN_TTL` | `30d` | Session token lifetime. |
| `DB_FILE` | `./data/db.json` | Created on first write. Gitignored — it holds real password hashes. |

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness probe. |
| `POST` | `/api/auth/register` | — | Create an account, returns `{ token, user }`. |
| `POST` | `/api/auth/login` | — | Exchange credentials for a token. |
| `GET` | `/api/auth/me` | Bearer | Current profile; used to validate a stored token. |
| `PATCH` | `/api/auth/me` | Bearer | Update the display name. |
| `DELETE` | `/api/auth/me` | Bearer | Delete the account and its state. |
| `GET` | `/api/state` | Bearer | Stored state, or `null` before the first sync. |
| `PUT` | `/api/state` | Bearer | Replace state; `409` if the stored copy is newer. |

Errors return `{ error, message }`, plus `field` when a specific input is at fault so the client can
highlight the right input.

## Design notes

**Passwords** use scrypt with a per-user salt and constant-time comparison — memory-hard, and in
Node's standard library, so there is no native build step. Hashes never appear in a response body;
the smoke suite asserts it. Login returns byte-identical responses for an unknown email and a wrong
password, so the endpoint cannot be used to enumerate accounts.

**The JSON store** ([src/db.js](src/db.js)) behaves like a database rather than a `fs.writeFile`
call. Every mutation is serialised through one promise chain, so concurrent requests cannot
interleave a read-modify-write and lose an update. Writes go to a temp file and are then renamed,
which is atomic on every mainstream filesystem — a crash mid-write cannot truncate the database.
Registration re-checks email uniqueness *inside* that queue, because another request could have
claimed the address between the read and the write. Swapping in Postgres would not require touching
a route.

**State writes** are last-write-wins on a client-supplied `updatedAt`. A write whose stamp is older
than the stored copy is refused with `409` and the server's copy is returned, so a second device
that synced in the meantime never gets silently overwritten.

## Limits

Single-node, whole file held in memory, and the entire user state is replaced per write. Fine for a
few thousand accounts; past that it wants a real database and per-field merging.
