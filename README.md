# Adaptive Wellness Companion — Backend Infrastructure

This repo contains the full data layer and auth system for the Adaptive Wellness Companion mental health app. Built with **React**, **Firebase (Firestore + Auth)**, and **TypeScript**.

---

## Quick Start

### 1. Clone & install dependencies

```bash
npm install
```

### 2. Set up your environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Firebase project values from the [Firebase Console](https://console.firebase.google.com) → Project Settings → General → Your Apps.

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

> Never commit `.env.local` — it is already in `.gitignore`.

### 3. Deploy Firestore security rules

```bash
firebase deploy --only firestore:rules
```

### 4. (Optional) Seed test data

```bash
npm run seed        # populate test user + 14 days of mood/session data
npm run clear-seed  # wipe all seeded data
```

---

## Project Structure

```
src/
├── firebase/
│   └── config.ts              # Firebase app, Auth, Firestore initialization
├── contexts/
│   └── AuthContext.tsx         # Global auth state + signup/login/logout
├── components/
│   └── auth/
│       ├── Login.jsx           # Login form
│       ├── SignUp.jsx          # Signup form with email verification
│       ├── ForgotPassword.jsx  # Password reset form
│       ├── ProtectedRoute.jsx  # Redirects unauthenticated users
│       └── authErrors.ts       # Maps Firebase error codes to friendly messages
├── services/
│   ├── userService.ts          # User profile CRUD
│   ├── sessionService.ts       # Sessions + messages CRUD + AI context
│   ├── moodService.ts          # Mood entry logging + trend calculation
│   ├── reportService.ts        # Shareable therapist report generation
│   └── privacyService.ts       # Account deletion (GDPR)
├── types/
│   └── index.ts               # All shared TypeScript interfaces
scripts/
├── seedData.ts                 # Populate dev database with test data
└── clearTestData.ts            # Wipe all seeded test data
firestore.rules                 # Firestore security rules
.env.example                    # Template for environment variables
```

---

## Feature-by-Feature Guide for Teammates

### AI Therapist Chatbot

These are the functions you need:

```ts
import { createSession, addMessage, endSession, getRecentContext } from './services/sessionService';
```

**Starting a session:**
```ts
const result = await createSession(uid, "therapy");
if (result.success) {
  const sessionId = result.data; // store this
}
```

**Saving each message turn:**
```ts
// User message
await addMessage(uid, sessionId, "user", userText);

// AI response (optionally include sentiment score from your analysis)
await addMessage(uid, sessionId, "assistant", aiResponse, 0.4);
```

**Long-term memory (inject into AI system prompt):**
```ts
const context = await getRecentContext(uid, 5);
// context.data = [{ sessionType, summary, date }, ...]
// Pass these summaries into your AI prompt as system context.
```

**Ending a session:**
```ts
await endSession(uid, sessionId, "AI-generated summary here", moodAfterScore);
```

> **Privacy rule:** Only pass transcribed text to `addMessage()`. Raw audio must be converted to text in the frontend (Web Speech API, Whisper, etc.) before any database call.

---

### Dream / Goal Visualization

Same session functions as the chatbot, just use `"dream_visualization"` as the session type:

```ts
await createSession(uid, "dream_visualization");
```

---

### Mood Tracking

```ts
import { addMoodEntry, getMoodEntries, getMoodTrend } from './services/moodService';
```

**Log a mood entry:**
```ts
await addMoodEntry(uid, 7, "Feeling hopeful today", ["hopeful", "calm"], "manual");
```

**Log a mood after a session:**
```ts
await addMoodEntry(uid, 8, "", [], "post_session", sessionId);
```

**Get trend data for a chart (last 30 days):**
```ts
const trend = await getMoodTrend(uid, 30);
// trend.data = [{ date: "2026-03-01", averageScore: 6.5 }, ...]
// Pass this array directly to your charting library.
```

---

### Cultural Bias Checking / Therapist Sharing

```ts
import { generateShareableReport, getSharedReport, deleteSharedReport } from './services/reportService';
```

**Generate a shareable link:**
```ts
const result = await generateShareableReport(uid, {
  start: new Date("2026-02-01"),
  end: new Date("2026-03-01"),
});
const shareToken = result.data;
const shareUrl = `https://yourapp.com/shared-report/${shareToken}`;
```

**What the therapist sees (no auth required):**
```ts
const report = await getSharedReport(shareToken);
// report.data.data.reportData = { moodTrend, sessionSummaries, averageMoodScore, ... }
```

**Revoke a link:**
```ts
await deleteSharedReport(uid, shareToken);
```

> Reports contain only aggregated mood averages and session summaries — never raw message transcripts.

---

## Authentication

Wrap your entire app in `<AuthProvider>` (in `App.tsx` or `index.tsx`):

```tsx
import { AuthProvider } from './contexts/AuthContext';

<AuthProvider>
  <App />
</AuthProvider>
```

Access auth state and actions anywhere:

```tsx
import { useAuth } from './contexts/AuthContext';

const { currentUser, login, logout, signup, resetPassword, loading } = useAuth();
```

| Value / Function | What it does |
|---|---|
| `currentUser` | Firebase User object or `null` if not logged in |
| `loading` | `true` while auth state is being resolved on page load |
| `signup(email, password)` | Creates account, sends verification email, creates Firestore profile |
| `login(email, password)` | Signs in, session persists across page refreshes |
| `logout()` | Signs out the current user |
| `resetPassword(email)` | Sends a password reset email |

**Protecting a route:**

```tsx
import ProtectedRoute from './components/auth/ProtectedRoute';

<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```

Unauthenticated users are redirected to `/login` and sent back to their original destination after signing in.

**Auth pages are already built** — just add these routes in your router:

| Path | Component |
|---|---|
| `/login` | `Login.jsx` |
| `/signup` | `SignUp.jsx` |
| `/forgot-password` | `ForgotPassword.jsx` |

---

## Firestore Database Schema

```
users/
└── {uid}                        ← user profile (email, displayName, preferences)
    ├── sessions/
    │   └── {sessionId}          ← one session (therapy, journal, etc.)
    │       └── messages/
    │           └── {messageId}  ← individual chat messages
    └── moodEntries/
        └── {entryId}            ← one mood log entry

sharedReports/
└── {reportId}                   ← time-limited therapist report (no raw messages)
```

Every document includes `createdAt` and `updatedAt` Firestore server timestamps.

---

## Service Function Return Values

Every service function returns a `ServiceResult<T>`:

```ts
// On success:
{ success: true, data: T }

// On failure:
{ success: false, error: "Human-readable error message" }
```

Always check `result.success` before using `result.data`:

```ts
const result = await getUserSessions(uid);
if (!result.success) {
  console.error(result.error);
  return;
}
const sessions = result.data;
```

---

## TypeScript Types

All shared interfaces live in [src/types/index.ts](src/types/index.ts). Import them in any file:

```ts
import type { UserProfile, Session, Message, MoodEntry, SharedReport } from '../types';
```

Key types:

| Type | Used for |
|---|---|
| `UserProfile` | `/users/{uid}` document |
| `Session` | `/users/{uid}/sessions/{id}` document |
| `Message` | Session message subcollection document |
| `MoodEntry` | Mood log subcollection document |
| `SharedReport` | Therapist-facing shareable report document |
| `WithId<T>` | Wraps any document type with its Firestore ID |
| `ServiceResult<T>` | Return envelope for all service functions |

---

## Privacy & Security Rules

The Firestore rules in [firestore.rules](firestore.rules) enforce:

- Users can only read/write their **own** data — zero cross-user access under any circumstances.
- Shared reports are readable by anyone with the token, but only while they are **not expired** and **under the access limit**.
- Mood entries are **immutable** after creation.
- Messages are **append-only** (only `sentimentScore` and `flagged` can be updated post-creation).
- Any collection not explicitly listed is **denied by default**.

### Account Deletion (GDPR)

```ts
import { deleteAllUserData } from './services/privacyService';

const result = await deleteAllUserData(currentUser.uid);
if (result.success) {
  await currentUser.delete(); // also removes the Firebase Auth record
}
```

This deletes: all messages, all sessions, all mood entries, all shared reports, and the user profile. **This is irreversible** — show a confirmation dialog before calling it.

---

## Privacy Constraints (Read Before Adding Features)

- **No raw audio** is ever stored. Voice input must be transcribed to text before any DB call.
- **No PII** beyond email. `displayName` is an optional alias — not a legal name. Do not add fields for real name, phone, address, insurance, or diagnosis codes.
- **Shared reports** contain only aggregated summaries and mood averages — never raw message transcripts.
- **No IP logging** anywhere in this data layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Auth | Firebase Authentication |
| Database | Firestore (NoSQL) |
| Language | TypeScript 5 |
| Routing | React Router v6 |
| Hosting | Vercel |
| Package manager | npm |
