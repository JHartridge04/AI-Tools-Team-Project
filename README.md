# Adaptive Wellness Companion

An accessible, AI-powered mental wellness app built to support people who can't easily access traditional therapy. Combines an adaptive AI therapist, guided meditation, dream visualization with AI-generated imagery, mood tracking, and a bias-aware cultural filter — all wrapped in a calming, inclusive interface.

**Live demo:** [https://adaptive-wellness-companion.vercel.app](https://adaptive-wellness-companion.vercel.app/)

---

## Features

### 🧠 Adaptive AI Therapist
Evidence-based therapeutic conversations powered by Claude. Uses techniques from cognitive behavioral therapy and motivational interviewing, remembers context from past sessions, and includes keyword-based crisis detection that surfaces the 988 Suicide & Crisis Lifeline when needed.

### 🌙 Dream & Goal Visualization
Users describe a dream, goal, or calm place in text. Claude generates a poetic guided visualization, and users can opt-in to generate an accompanying AI image via DALL-E 3. Every image prompt is first routed through the Cultural Mirror for inclusive, bias-aware output.

### 🧘 Guided Meditation
Similar to dream visualization but focused on breath awareness, body scanning, and grounding. Shares the same visualization infrastructure with a distinct system prompt, UI identity, and tone.

### 📓 Journal Entries
Reflective writing companion that uses a journaling-focused AI persona to prompt gratitude, daily reflection, and emotional processing. Shares the session/message architecture with the therapy chat.

### 📊 Mood Tracking
1–10 scale mood logging with optional notes and tag pills (anxious, hopeful, tired, grateful, etc.). Visualizes 7 / 14 / 30-day mood trends on the dashboard.

### ◈ Cultural Mirror
A standalone bias-audit feature (and internal filter) that checks AI outputs and image prompts for implicit bias — racial, gender, religious, cultural, socioeconomic — and rewrites them to be inclusive while preserving intent. Runs as both a user-facing tool (`/cultural-mirror`) and an internal pipeline step for image generation.

### 🔒 Privacy-First Account Management
- Email/password auth with email verification
- Password reset with return-to-app redirect
- Full account deletion with re-authentication (GDPR-style data erasure)
- Shareable therapist reports (time-limited, access-capped tokens with no raw transcripts)

---

## Live Deployment

| Service | Platform | Purpose |
|---|---|---|
| Frontend | **Vercel** | React app, auto-deploys from `main` |
| Backend Proxy | **Render** | Express server for AI API calls, auto-deploys from `main` |
| Database | **Firestore** | User data, sessions, messages, mood entries |
| Authentication | **Firebase Auth** | Email/password with verification |
| AI Text | **Anthropic Claude** | Therapy, journal, meditation, dream visualization, bias audits |
| AI Images | **OpenAI DALL-E 3** | Dream and meditation imagery |

API keys live exclusively on the backend. The frontend never talks directly to any AI provider — all calls route through the Render proxy to keep secrets out of the browser bundle.

---

## Quick Start (Local Development)

### 1. Clone & install frontend dependencies

```bash
git clone [https://github.com/JHartridge04/Adaptive-Wellness-Companion.git]
cd AI-Tools-Team-Project
npm install --legacy-peer-deps
```

### 2. Install backend dependencies

```bash
cd server
npm install
cd ..
```

### 3. Set up your environment variables

**Frontend** — copy the template and fill in your Firebase values:

```bash
cp .env.example .env.local
```

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_API_URL=http://localhost:3001
```

**Backend** — copy the template and fill in your AI API keys:

```bash
cp server/.env.example server/.env
```

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
ALLOWED_ORIGINS=http://localhost:3000
```

> Never commit `.env.local` or `server/.env`. Both are in `.gitignore`.

### 4. Deploy Firestore security rules

In the Firebase Console → Firestore Database → Rules, paste the contents of `firestore.rules` and click Publish.

### 5. Start both servers

**Terminal 1** (backend proxy):
```bash
cd server
npm start
```
Runs on `http://localhost:3001`.

**Terminal 2** (React app):
```bash
npm start
```
Runs on `http://localhost:3000`.

Visit [http://localhost:3000](http://localhost:3000) and you're live.

---

## Project Structure

```
AI-Tools-Team-Project/
├── server/                           # Express backend proxy
│   ├── index.js                      # Endpoints for Claude, DALL-E, Cultural Mirror
│   ├── package.json
│   └── .env.example
├── src/
│   ├── App.tsx                       # Routing hub + auth provider
│   ├── index.tsx                     # React entry point
│   ├── firebase/
│   │   └── config.ts                 # Firebase initialization
│   ├── contexts/
│   │   └── AuthContext.tsx           # Global auth state
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── SignUp.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── authErrors.ts
│   │   ├── layout/
│   │   │   └── AppLayout.tsx         # Sidebar + top bar + mobile tabs
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorMessage.tsx
│   │       └── EmptyState.tsx
│   ├── pages/
│   │   ├── Home.tsx                  # Public landing page
│   │   ├── Dashboard.tsx             # Mood chart + quick actions + recent sessions
│   │   ├── SessionHistory.tsx        # Filterable list of all sessions
│   │   ├── SessionDetail.tsx         # Therapy / journal chat UI
│   │   ├── SessionRouter.tsx         # Type-aware session redirect
│   │   ├── DreamVisualization.tsx    # Dream + meditation visualization UI
│   │   ├── MoodTracker.tsx           # Log and view mood
│   │   ├── CulturalMirror.tsx        # Bias audit demo page
│   │   ├── Settings.tsx              # Profile, sharing, account deletion
│   │   ├── SharedReportView.tsx      # Public therapist report view
│   │   └── NotFound.tsx
│   ├── services/
│   │   ├── userService.ts            # User profile CRUD
│   │   ├── sessionService.ts         # Sessions + messages CRUD + context memory
│   │   ├── moodService.ts            # Mood logging + trend calculation
│   │   ├── reportService.ts          # Shareable therapist reports
│   │   ├── privacyService.ts         # Account deletion cascade
│   │   ├── imageService.ts           # DALL-E image generation client
│   │   └── culturalMirrorService.ts  # Bias audit client
│   ├── styles/
│   │   ├── global.css                # Design tokens + base styles
│   │   ├── layout.css                # AppLayout styles
│   │   ├── home.css                  # Landing page styles
│   │   └── culturalMirror.css        # Cultural Mirror page styles
│   └── types/
│       └── index.ts                  # All shared TypeScript interfaces
├── scripts/
│   ├── seedData.ts                   # Populate dev database with test data
│   └── clearTestData.ts              # Wipe all seeded test data
├── firestore.rules                   # Firestore security rules
├── .env.example                      # Frontend env template
├── .npmrc                            # Enables legacy-peer-deps for react-scripts
└── README.md
```

---

## Routing

React Router v6 with a single `<BrowserRouter>` wrapping the tree.

| Path | Component | Auth | Notes |
|---|---|---|---|
| `/` | `Home` or redirect | — | Home page for logged-out users, `/dashboard` for logged-in |
| `/login` | `Login` | No | |
| `/signup` | `SignUp` | No | |
| `/forgot-password` | `ForgotPassword` | No | |
| `/shared-report/:reportId` | `SharedReportView` | No | Public, tokenized |
| `/dashboard` | `Dashboard` | ✅ | Mood chart + quick actions |
| `/sessions` | `SessionHistory` | ✅ | Filterable list |
| `/session/:sessionId` | `SessionRouter` | ✅ | Dispatches to the right UI based on session type |
| `/sessions/:sessionId` | `SessionDetail` | ✅ | Therapy + journal chat |
| `/dream/:sessionId` | `DreamVisualization` | ✅ | Dream + meditation UI |
| `/mood` | `MoodTracker` | ✅ | Log + trend view |
| `/cultural-mirror` | `CulturalMirror` | ✅ | Bias audit tool |
| `/settings` | `Settings` | ✅ | Profile + account deletion + report sharing |
| `*` | `NotFound` | — | 404 fallback |

---

## Backend API

The Express proxy in `server/index.js` exposes three endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/chat` | Routes therapy, journal, meditation, and dream visualization messages to Claude with session-type-specific system prompts. Injects recent session context for memory. |
| `POST /api/cultural-mirror` | Audits text (image prompts or therapist responses) for bias, returns structured `BiasAudit` JSON with optional inclusive rewrite. |
| `POST /api/generate-image` | Routes prompts through Cultural Mirror → calls DALL-E 3 → downloads the image server-side → returns as base64 data URL to bypass CDN reachability issues on restricted networks. |

All endpoints are authenticated via CORS against the `ALLOWED_ORIGINS` env variable (comma-separated list of allowed frontend origins).

---

## Service Function Return Pattern

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
  setError(result.error);
  return;
}
const sessions = result.data;
```

---

## Firestore Database Schema

```
users/
└── {uid}                        ← user profile (email, displayName, preferences)
    ├── sessions/
    │   └── {sessionId}          ← therapy, journal, dream, or meditation session
    │       └── messages/
    │           └── {messageId}  ← chat messages (text only, never audio)
    └── moodEntries/
        └── {entryId}            ← mood log with score + tags + source

sharedReports/
└── {reportId}                   ← time-limited tokenized therapist report
```

Every document has `createdAt` and `updatedAt` server timestamps.

---

## TypeScript Types

Shared interfaces live in [`src/types/index.ts`](src/types/index.ts):

| Type | Used for |
|---|---|
| `UserProfile` | User profile document |
| `Session` | Therapy / journal / dream / meditation session |
| `Message` | Session message |
| `MoodEntry` | Mood log entry |
| `SharedReport` | Tokenized therapist report |
| `BiasAudit` | Cultural Mirror audit response |
| `SessionType` | Union: `"therapy" \| "journal" \| "dream_visualization" \| "meditation"` |
| `WithId<T>` | Wraps a Firestore document with its auto-generated ID |
| `ServiceResult<T>` | Standard success/error envelope |

---

## Privacy & Safety

### Data Principles
- **No raw audio** is ever persisted. Voice input must be transcribed in the browser before calling any service.
- **No PII** beyond email. `displayName` is an optional alias — not a legal name. No fields for real names, phone, address, insurance, or diagnosis codes.
- **Shared reports** contain only aggregated summaries and mood averages — never raw message transcripts.
- **No IP logging** anywhere in the data layer.

### Security Rules
The rules in [`firestore.rules`](firestore.rules) enforce:
- Users can only read/write their **own** data — zero cross-user access
- Shared reports are readable via unguessable tokens, capped by expiry and max-access count
- Mood entries are **immutable** after creation
- Messages are **append-only** (only `sentimentScore` and `flagged` may be updated after creation)
- Any collection not explicitly listed is **denied by default**

### Account Deletion (GDPR-style)
Users can delete their accounts from Settings. The cascade deletes (in order):
1. Messages within each session
2. Sessions
3. Mood entries
4. Shared reports owned by the user
5. User profile
6. Firebase Auth record

Re-authentication with password is required immediately before deletion.

### Crisis Safety
The therapy AI includes keyword-based crisis detection. When triggered, it immediately surfaces the 988 Suicide & Crisis Lifeline and Crisis Text Line (741741). The app includes these resources prominently in the public home page footer as well. **This app is not a substitute for professional mental health care** — that's stated explicitly throughout the UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 |
| Language | TypeScript 5 |
| Routing | React Router v6 |
| Styling | CSS custom properties (no framework) |
| Auth | Firebase Authentication |
| Database | Firestore (NoSQL) |
| Backend Proxy | Express.js on Node 18 |
| AI Text | Anthropic Claude Sonnet 4.6 |
| AI Images | OpenAI DALL-E 3 |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Package Manager | npm |
| Version Control | Git + GitHub |

---

## Disclaimer

This app is a wellness companion and **not a substitute for professional mental health care**. If you or someone you know is in crisis, please contact the 988 Suicide & Crisis Lifeline (call or text 988 in the US) or the Crisis Text Line (text HOME to 741741).
