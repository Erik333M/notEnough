# Getting into the App Store

What the code now covers, and what is still a decision or an account.

## Done in the code

- **Bundle identifier** `com.notenough.app`, iOS and Android, with a build
  number and version code. **Change it before your first submission if you
  want a different one** — after that it is the app's permanent identity and
  cannot be changed.
- **`eas.json`** with development, preview and production profiles.
- **Privacy manifest** (`ios.privacyManifests`) declaring the two required-reason
  APIs this app touches: `UserDefaults` via AsyncStorage (`CA92.1`) and file
  timestamps (`C617.1`).
- **In-app account deletion** — Settings → Delete account. Apple requires this
  of any app that lets people create an account, and it is a common rejection.
- **Moderation**, which Guideline 1.2 requires of any app carrying
  user-generated content. This one carries it in four places: the event
  channel, the friend feed, team walls, and display names.
  - a **filter** that refuses obvious slurs before they post, including in
    names;
  - **reporting** on every message and post, with a reason and an optional
    note, kept even when the account it concerns is deleted;
  - **blocking**, two-directional and immediate, undoable in Settings.
- **No analytics, tracking, ads or third-party SDK**, so there is nothing to
  declare for App Tracking Transparency and no ATT prompt.
- Health answers never leave the device, so they are **not "collected"** for
  the privacy label.

## Still needed from you

### 1. A home for the server

The blocker. See [BUILDING.md](BUILDING.md) — it needs a persistent disk, a
long-lived process and exactly one instance, which rules out the usual free
serverless tiers. Until it exists, every account-backed feature fails for
every user.

### 2. Decide the minimum age

Camps have age groups like 10–14, and campers create their own accounts with
an email address. That is squarely inside COPPA and Apple's rules for
children.

Two honest routes:

- **13+ (or 16+ in the EU).** Say so at sign-up, set the age rating to match,
  and state in the listing that the app is not directed at children. Adults
  organise; younger campers are managed by staff rather than holding accounts.
- **Take on the children's rules.** Parental consent at sign-up, and the Kids
  Category obligations.

This changes the sign-up screen, so decide before building it.

### 3. Apple Developer Program

$99/year. Nothing else can be submitted without it.

### 4. A hosted privacy policy

`PRIVACY.md` lives in this repository; App Store Connect needs a public URL.
GitHub Pages is enough.

### 5. A EULA, or Apple's standard one

Apps with user-generated content must have terms where users accept that
there is no tolerance for objectionable content or abusive behaviour. Apple's
standard EULA covers this if you do not want to write one.

### 6. The listing

App name, subtitle, description, keywords, support URL, marketing URL,
screenshots at the required sizes, and the App Privacy answers.

For the privacy answers: this app collects **name, email address, and the
training figures you choose to publish**. It does not collect health data —
that stays on the device — and it does not track.

## Likely review questions

- **"How do you moderate user-generated content?"** Filter, report, block, all
  three in the app. Point at Settings → Blocked and the flag on any post.
- **"Who is this for, given the camp age groups?"** Answer from the decision
  in section 2 above, and make sure the age rating agrees with it.
- **"What is the account for?"** Teams, events, friends. The app is fully
  usable without one, which is worth saying — it is a point in your favour.
