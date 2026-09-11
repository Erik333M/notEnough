# Privacy Policy

**Last updated: 11 September 2026**

NOTenough is a training journal. This document describes exactly what the app
stores, where it stores it, and what you can delete. It describes the app as it
is actually built — every claim below corresponds to code in this repository,
and the file paths are given so you can check.

---

## The short version

- Everything you write is kept **on your device** first. The app works fully
  offline.
- If you create an account, your journal is **synced to a server that you or
  the operator of this app runs** — not to any third party.
- Your **injuries, medical conditions and emergency contact are never synced**.
  They are stored in your device's secure keystore and never leave the phone.
- There is **no analytics, no tracking, no advertising, and no third-party SDK**
  receiving your data.
- You can delete your health answers and your entire account from inside the
  app.

---

## What is stored on your device

| What | Where | Notes |
| --- | --- | --- |
| Your journal — daily entries, workouts, benchmarks, measurements, habits, goals, sessions | App storage (`AsyncStorage`) | The app's working copy. Present whether or not you are signed in. |
| Your sign-in token | Secure keystore (iOS Keychain / Android Keystore) | Never your password. |
| Your starting questions — training habits, sports, **injuries, medical conditions, emergency contact** | Secure keystore, under a separate per-account key | See "Health information" below. |
| Reminder schedules | The operating system's local notification store | Scheduled on the device. |

Relevant code: [`src/lib/storage.ts`](src/lib/storage.ts),
[`src/lib/secure.ts`](src/lib/secure.ts),
[`src/state/journey/intake.ts`](src/state/journey/intake.ts).

## What is sent to the server

Only if you create an account, and only when the app can reach the server.

| What | Why |
| --- | --- |
| Name, email address | To identify your account. |
| Password | Sent once when you register or sign in. It is stored only as a scrypt hash with a per-account salt — never in plain text. |
| Your journal state | So the same account shows the same journal on another device. |

The server is the small Node service in [`server/`](server/). It is run by you
or by whoever operates this app. It uses no external database and no
third-party processor.

Relevant code: [`src/state/sync.ts`](src/state/sync.ts),
[`src/api/client.ts`](src/api/client.ts),
[`server/src/routes/state.js`](server/src/routes/state.js).

## Health information stays on your phone

When you start the feature the app offers a few optional questions, including
injuries, medical conditions and who to contact in an emergency.

These answers are treated differently from everything else:

- They are written to the **secure keystore**, not to the app's ordinary
  storage.
- They are stored under **their own key**, entirely outside the data structure
  that gets synced. There is no code path that can upload them.
- Every question is optional, and skipping is recorded as an answer so you are
  not asked again.
- Nothing about them is written to logs.

You can delete them at any time: **Journey → Progress → Delete my answers**.
Deletion is immediate and cannot be undone.

Relevant code: [`src/state/journey/intake.ts`](src/state/journey/intake.ts).

## What the app does not do

- **No analytics or telemetry.** There is no analytics SDK in the project.
- **No advertising, and no data is sold or shared for marketing.**
- **No push notification service.** Reminders are scheduled locally by the
  operating system; no push token is collected and no server sends you
  messages.
- **No location tracking.** The run timer measures elapsed time and a distance
  you enter yourself; it does not read GPS.
- **No contacts, photo or microphone access.**

## Your controls

| You want to | Do this | What happens |
| --- | --- | --- |
| Delete your health answers | Journey → Progress → *Delete my answers* | Removed from the keystore immediately. |
| Delete your account and everything synced | Settings → *Delete account* | Your account row and your stored journal are both removed from the server. |
| Stop syncing | Settings → *Sign out* | The token is cleared. The app keeps working offline. |
| Use the app with no account at all | Never sign in | Nothing is sent anywhere. |

Account deletion is implemented in
[`server/src/routes/auth.js`](server/src/routes/auth.js) and removes both the
user record and the synced state.

## Retention

Your journal stays on the server for as long as the account exists. Deleting
the account removes it. There are no backups kept by the app itself; if the
operator backs up the server's data file, that is their responsibility to
disclose.

## Security

- Passwords are hashed with scrypt and a per-account salt, server-side.
- Sign-in tokens live in the device's secure keystore, not in ordinary storage.
- Health answers live in the same secure keystore.

If you deploy the server yourself, **serve it over HTTPS** and set a real
`JWT_SECRET`. The server refuses to start in production without one. Over plain
HTTP on an untrusted network, anything sent between the app and the server can
be read by others.

## Children

This app is not directed at children under 13 and should not be used by them
without a parent or guardian.

## Changes

If this policy changes materially, the "last updated" date above changes with
it, and the in-app copy is updated in the same commit. This file and the
in-app privacy screen are kept in step deliberately —
[`src/screens/PrivacyScreen.tsx`](src/screens/PrivacyScreen.tsx) is the same
content in the same order.

## Contact

Raise an issue on the project repository.
