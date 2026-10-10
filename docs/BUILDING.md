# Building for a store

## Before anything else: the API needs a home

`EXPO_PUBLIC_API_URL` in `eas.json` is `https://REPLACE-ME.example.com` on
purpose — it is a placeholder that will fail loudly rather than a localhost
that fails silently on every user's phone.

A built app cannot reach your laptop. Accounts, teams, events, chat and
friends all stop at that URL; everything else keeps working from the device,
which is exactly what makes a wrong value here hard to notice.

The server has three requirements that rule out most cheap hosting:

- **A persistent disk.** The database is `server/data/db.json`, chat is
  `db.messages.json`, and every avatar is a file beside them. Vercel, Netlify
  and Cloudflare Workers all have throwaway filesystems.
- **A long-lived process.** The chat socket stays open.
- **Exactly one instance.** The database is cached in memory behind a single
  write queue; two copies would each hold their own and overwrite each other.

So: a small always-on machine with a volume, pinned to one instance. Set
`JWT_SECRET` there, or the server refuses to start in production.

## Then

```bash
npm install -g eas-cli
eas login
eas build:configure          # links the project to your Expo account
```

`preview` builds an installable Android APK you can send to anybody — free,
no store, no review. `production` builds for the stores.

```bash
eas build --profile preview --platform android
eas build --profile production --platform ios
```

## What the stores still need from you

Collected in [STORE.md](STORE.md), including the parts that are decisions
rather than code.
