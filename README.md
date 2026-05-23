# Strasbourg Mission

An educational outdoor escape-game web app for ~100 students walking through Strasbourg. Students enter a team code on their smartphones, receive sequential location clues, and submit answers at each station.

**Stack:** Next.js 16 · TypeScript · TailwindCSS · Firebase Firestore · Zustand · Vercel

---

## Local Setup

### Prerequisites

- Node.js 20+
- npm 9+
- A Firebase project (free Spark plan is sufficient)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Firebase credentials (see Firebase setup below).

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Firebase Setup

### Create a project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `strasbourg-mission`) → disable Google Analytics → **Create project**

### Enable Firestore

1. In the left sidebar: **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (the starter rules in `firestore.rules` replace these)
4. Select a region close to Strasbourg: `europe-west1` (Belgium) or `eur3` (multi-region)

### Get your web app credentials

1. **Project settings** (gear icon) → **General** → scroll to **Your apps**
2. If no web app exists: click **Add app → Web**, register it (no Firebase Hosting needed)
3. Copy the `firebaseConfig` values into `.env.local`

### Deploy Firestore rules and indexes

Install the Firebase CLI if you haven't:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point to your project; use existing firestore.rules + firestore.indexes.json
```

Then deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Firestore Collections

### `teams/{teamCode}`

One document per team. Document ID **is** the team code (used as lookup key).

```json
{
  "teamName": "Alpha",
  "teamCode": "ALPHA-7",
  "role": "student",
  "createdAt": 1716000000000
}
```

Create these manually in the Firebase Console before the mission, or via a seed script.

### `stations/{stationId}`

Mission config. Static — seeded once by admin, never written by clients.

```json
{
  "order": 1,
  "title": "Cathédrale Notre-Dame",
  "locationHint": "Stand at the main entrance. Look above the central arch.",
  "challengeType": "text"
}
```

`challengeType` values: `"text"` · `"qr"` · `"multiple-choice"`

### `progress/{teamId}`

One document per team. `teamId` matches the team's `teamCode`.

```json
{
  "teamId": "ALPHA-7",
  "progress": {
    "station-1": "completed",
    "station-2": "active",
    "station-3": "locked"
  },
  "currentStationId": "station-2",
  "startedAt": 1716000000000,
  "finishedAt": null,
  "finalAnswer": null,
  "resetAt": null
}
```

`progress` values per station: `"locked"` · `"active"` · `"completed"`

### Firestore indexes

No composite indexes are required at this stage. The only ordered query (`orderBy("order")` on `stations`) uses Firestore's auto-generated single-field index. If you later add a filtered + ordered query, Firestore will throw an error with a direct link to create the required index — add it to `firestore.indexes.json` and redeploy.

---

## Vercel Deployment

1. Push the repository to GitHub
2. Go to [https://vercel.com/new](https://vercel.com/new) and import the repo
3. Add environment variables in **Settings → Environment Variables**:
   - Add all six `NEXT_PUBLIC_FIREBASE_*` values from your `.env.local`
   - Set them for **Production**, **Preview**, and **Development** environments
4. Click **Deploy**

### Production checklist

- [ ] All six Firebase env vars set in Vercel
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] At least one `teams` document created for testing
- [ ] At least one `stations` document created (`order: 1`)
- [ ] Login flow verified end-to-end with a real team code
- [ ] Tested on iPhone Safari and Android Chrome before the event
- [ ] Custom domain configured in Vercel (shorter URL = easier for students)

---

## Mobile Testing Checklist

Test every release on a real device, ideally outdoors or in bright light.

### iPhone Safari

- [ ] Safe-area insets respected — content not hidden behind notch or home indicator
- [ ] `viewport-fit=cover` renders correctly (no white bars on sides)
- [ ] Status bar uses `black-translucent` and blends with `#0B1426` background
- [ ] Form inputs do not trigger page zoom on focus (font-size ≥ 16px everywhere)
- [ ] Autofill overlay does not obscure the Submit button
- [ ] Back navigation works via both the PageHeader button and the browser swipe gesture

### Android Chrome

- [ ] Navigation bar `themeColor` matches app background
- [ ] Touch targets register cleanly with no misfire on adjacent elements
- [ ] Keyboard appearance does not push the Submit button off screen
- [ ] PWA install banner appears correctly

### Outdoor readability

- [ ] Text legible in direct sunlight (gold/cream on dark navy — tested contrast: 8:1+)
- [ ] No critical information conveyed by color alone
- [ ] Station status readable at arm's length
- [ ] Error messages visible without squinting

### Touch targets

- [ ] Every tappable element is at minimum 44 × 44 px
- [ ] Station cards are easy to tap with one thumb on a large phone
- [ ] Submit buttons span full width for reliable tap in outdoor conditions

### Offline and recovery behavior

- [ ] Closing and reopening the app restores the team session (Zustand persist)
- [ ] Closing mid-station and reopening returns to the same station
- [ ] If Firebase is unreachable on mount, the app shows last known state (not a crash)
- [ ] Submitting an answer with no connection shows a clear error message
- [ ] After connectivity is restored, retrying the submission succeeds without duplicate state

---

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Production build (run before deploying) |
| `npm run seed` | Populate Firestore with stations, teams, and initial progress |
| `npm run verify` | Read-only pre-flight check — run before every mission |
| `npm run reset:progress` | Wipe all team progress back to initial state (requires confirmation) |

---

## Pre-Mission Checklist

Run this sequence **the day before** the event and again **30 minutes before** handing out codes.

### Day before

```bash
# 1. Seed the database (idempotent — safe to re-run)
npm run seed

# 2. Verify everything is in order
npm run verify
```

- [ ] `npm run verify` exits with code 0 (all green)
- [ ] Test login with one team code on a real device (e.g. `ALPHA-1`)
- [ ] Walk through station 1 end-to-end: see location hint → submit correct answer → see reward letter
- [ ] Confirm the final cipher page appears after completing all 6 stations in dev/staging
- [ ] Deploy latest build to Vercel if you made any changes: `git push`

### 30 minutes before the event

```bash
npm run verify
```

- [ ] All checks pass
- [ ] Admin dashboard loads at `/admin` (shows 8 teams, all "Not started")
- [ ] URL is shared with all groups (QR code or shortlink recommended)
- [ ] Each team lead has their team code written down as a backup

---

## Teacher Workflow During the Event

### Starting

1. Announce the URL and team codes.
2. Each group opens the URL on one phone and enters their code.
3. Open `/admin` on your phone — refresh every few minutes to see team progress.

### During

- The admin page shows: progress (X/6), current station, and whether a team has finished.
- If a team is stuck at 0/6 for more than 10 minutes, ask if they logged in successfully.
- If a team is stuck at the same station for a long time, give a verbal hint — the app does not have a hint system.
- Teams finish at different times — first-finishers can wait at the final location or help others.

### Ending

- All finished teams are marked **Finished** on the admin dashboard.
- The final answer is `ALSACE` — students discover this by assembling their collected letters.
- Collect team phones (or confirm they've seen the success screen) before dismissing.

---

## Recovering from Common Failures

### A team can't log in

**Symptom:** "Team code not found" on the login screen.

**Cause:** The team document doesn't exist in Firestore, or the code was typed incorrectly.

**Fix:**
1. Check `npm run verify` — if the team doc is missing, run `npm run seed`.
2. Confirm the code is uppercase and hyphenated (e.g. `ALPHA-1`, not `alpha1`).

---

### A team is stuck on the wrong station

**Symptom:** A team's progress doc has the wrong `currentStationId` (visible in Firebase Console).

**Cause:** Usually a race condition from double-tapping or an incomplete submission.

**Fix (without resetting all teams):**
1. Open Firebase Console → Firestore → `progress/{teamCode}`
2. Manually set `currentStationId` to the correct station ID
3. Set `progress.{stationId}` to `"active"` for that station
4. Ask the team to reload the app

---

### A team's app shows blank / crashes

**Symptom:** Blank screen, loading spinner that never resolves, or crash message.

**Cause A:** Firebase unreachable (poor signal). The app shows last known state — ask the team to move somewhere with better signal and tap "Try again".

**Cause B:** Corrupted localStorage. Fix: ask the student to clear site data in Safari/Chrome settings, then log in again. Their Firebase progress is preserved.

---

### Firebase returns permission errors

**Symptom:** Red error banners on multiple teams simultaneously.

**Cause:** Firestore rules may have expired or been accidentally changed.

**Fix:**
```bash
firebase deploy --only firestore:rules
```

---

### All teams need to restart (next class / next day)

```bash
npm run reset:progress
```

The script shows current state, asks for confirmation, then restores all 8 teams to their rotated starting positions. Teams that have not yet opened the app are unaffected.

After resetting, run `npm run verify` to confirm the reset was clean.

---

## Between-Class Reset Procedure

Full reset sequence for a new class:

```bash
# 1. Wipe all progress (requires typing "YES")
npm run reset:progress

# 2. Confirm clean state
npm run verify

# 3. Confirm on admin dashboard at /admin
#    → All teams should show "Not started"
```

The `teams` and `stations` collections are **never touched** by `reset:progress`. Only the `progress` collection is modified.
