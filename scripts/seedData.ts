/**
 * seedData.ts — Populates Firestore with realistic test data.
 *
 * HOW TO RUN:
 *   npx ts-node scripts/seedData.ts
 *
 * PREREQUISITES:
 *   1. Install deps:  npm install ts-node firebase dotenv
 *   2. Copy .env.example → .env.local and fill in your Firebase credentials.
 *   3. Create the test user manually in Firebase Auth console first, OR
 *      uncomment the Firebase Admin SDK block below to create the user
 *      programmatically (requires a service account key).
 *
 * WHAT IT CREATES:
 *   • 1 test user profile (uses a known UID you supply below)
 *   • 4 sessions (2 therapy, 1 dream_visualization, 1 journal) with messages
 *   • 14 days of mood entries with realistic variation
 *   • 1 shared report
 *
 * Test credentials (create this user in Firebase Auth Console first):
 *   Email:    test@wellness-app.dev
 *   Password: TestPass123!
 *   UID:      Set TEST_USER_UID below after creating the account.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";

// ─── Config ───────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// ⚠️  Set this to the UID of the test user you created in Firebase Auth Console
const TEST_USER_UID = "REPLACE_WITH_TEST_USER_UID";
const TEST_USER_EMAIL = "test@wellness-app.dev";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
}

function hoursAgo(n: number): Timestamp {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return Timestamp.fromDate(d);
}

// ─── Seed runner ─────────────────────────────────────────────────────────────

async function seed() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const uid = TEST_USER_UID;

  console.log("🌱  Starting seed...");

  // ── 1. User profile ──────────────────────────────────────────────────────
  await setDoc(doc(db, "users", uid), {
    email: TEST_USER_EMAIL,
    displayName: "Alex (Test User)",
    preferredTherapyMode: "talk",
    onboardingComplete: true,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
  });
  console.log("  ✓ User profile created");

  // ── 2. Sessions & Messages ───────────────────────────────────────────────

  // Session 1 — Completed therapy session (5 days ago)
  const s1Ref = await addDoc(collection(db, "users", uid, "sessions"), {
    sessionType: "therapy",
    title: "Therapy — Managing work stress",
    summary:
      "User discussed anxiety around upcoming project deadline. Explored cognitive reframing techniques. Mood improved from 4 to 6 during session. Key insight: separating effort from outcome.",
    overallMoodScore: 6,
    moodBefore: 4,
    moodAfter: 6,
    status: "completed",
    startedAt: daysAgo(5),
    endedAt: daysAgo(5),
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  });
  const s1Messages = [
    { role: "system", content: "Session started. User mood before: 4/10.", flagged: false, sentimentScore: null, timestamp: daysAgo(5) },
    { role: "user", content: "I've been feeling really overwhelmed with work lately. My manager keeps piling on tasks and I don't know how to say no.", flagged: false, sentimentScore: -0.6, timestamp: daysAgo(5) },
    { role: "assistant", content: "It sounds like you're carrying a heavy load right now. When you say overwhelmed, can you tell me more about what that feels like in your body or your day-to-day?", flagged: false, sentimentScore: 0.1, timestamp: daysAgo(5) },
    { role: "user", content: "I can't sleep well. I keep thinking about all the things I haven't finished. It's like my brain won't shut off.", flagged: false, sentimentScore: -0.7, timestamp: daysAgo(5) },
    { role: "assistant", content: "That cycle of rumination at night is really common when we're under sustained pressure. One thing that can help is distinguishing between what you can control today versus what you're projecting into the future. Would you like to try that together?", flagged: false, sentimentScore: 0.2, timestamp: daysAgo(5) },
    { role: "user", content: "Yes, let's try that. I think that might help.", flagged: false, sentimentScore: 0.3, timestamp: daysAgo(5) },
  ];
  for (const msg of s1Messages) {
    await addDoc(collection(db, "users", uid, "sessions", s1Ref.id, "messages"), msg);
  }
  console.log("  ✓ Session 1 (therapy) + messages");

  // Session 2 — Dream visualization (3 days ago)
  const s2Ref = await addDoc(collection(db, "users", uid, "sessions"), {
    sessionType: "dream_visualization",
    title: "Dream Visualization — The forest clearing",
    summary:
      "User visualized a peaceful forest clearing. Identified a recurring symbol of a locked door representing a career decision they're avoiding. Mood remained stable at 7 throughout.",
    overallMoodScore: 7,
    moodBefore: 6,
    moodAfter: 7,
    status: "completed",
    startedAt: daysAgo(3),
    endedAt: daysAgo(3),
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  });
  const s2Messages = [
    { role: "system", content: "Dream visualization session started.", flagged: false, sentimentScore: null, timestamp: daysAgo(3) },
    { role: "user", content: "I keep having this dream about a forest. There's a clearing and I always feel peaceful there, but there's a locked door at the edge.", flagged: false, sentimentScore: 0.1, timestamp: daysAgo(3) },
    { role: "assistant", content: "That sounds like a rich image. The clearing as a peaceful space, and the door as something unknown or inaccessible. In dream symbolism, locked doors often represent choices or paths we haven't yet decided to take. Does that resonate with anything in your waking life?", flagged: false, sentimentScore: 0.3, timestamp: daysAgo(3) },
    { role: "user", content: "Actually yes — I've been putting off making a decision about whether to stay in my current job or look for something new.", flagged: false, sentimentScore: -0.1, timestamp: daysAgo(3) },
  ];
  for (const msg of s2Messages) {
    await addDoc(collection(db, "users", uid, "sessions", s2Ref.id, "messages"), msg);
  }
  console.log("  ✓ Session 2 (dream visualization) + messages");

  // Session 3 — Journal (2 days ago)
  const s3Ref = await addDoc(collection(db, "users", uid, "sessions"), {
    sessionType: "journal",
    title: "Journal — Gratitude reflection",
    summary:
      "User wrote a gratitude journal entry focusing on small wins: a supportive friend conversation, finishing a difficult task, and a good meal. Mood lifted from 5 to 7.",
    overallMoodScore: 7,
    moodBefore: 5,
    moodAfter: 7,
    status: "completed",
    startedAt: daysAgo(2),
    endedAt: daysAgo(2),
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  });
  const s3Messages = [
    { role: "user", content: "Today I'm grateful for my friend Maya who checked in on me. I also finally finished the report that was stressing me out, and I made a really nice dinner.", flagged: false, sentimentScore: 0.8, timestamp: daysAgo(2) },
    { role: "assistant", content: "These are meaningful things to notice. Social connection, completing something that weighed on you, and taking care of yourself with a good meal — those cover several important wellbeing pillars. How does it feel to name them?", flagged: false, sentimentScore: 0.5, timestamp: daysAgo(2) },
    { role: "user", content: "Actually lighter. I forget to notice the good stuff when I'm stressed.", flagged: false, sentimentScore: 0.4, timestamp: daysAgo(2) },
  ];
  for (const msg of s3Messages) {
    await addDoc(collection(db, "users", uid, "sessions", s3Ref.id, "messages"), msg);
  }
  console.log("  ✓ Session 3 (journal) + messages");

  // Session 4 — Active therapy session (today, not yet ended)
  const s4Ref = await addDoc(collection(db, "users", uid, "sessions"), {
    sessionType: "therapy",
    title: "Therapy — Today's check-in",
    summary: "",
    overallMoodScore: null,
    moodBefore: 7,
    moodAfter: null,
    status: "active",
    startedAt: hoursAgo(1),
    endedAt: null,
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
  });
  await addDoc(collection(db, "users", uid, "sessions", s4Ref.id, "messages"), {
    role: "user",
    content: "I'm feeling pretty good today actually. Had a solid night's sleep for the first time in a while.",
    flagged: false,
    sentimentScore: 0.7,
    timestamp: hoursAgo(1),
  });
  console.log("  ✓ Session 4 (active therapy) + messages");

  // ── 3. Mood Entries — 14 days of realistic data ──────────────────────────
  const moodData = [
    // [daysAgo, score, note, tags, source]
    [14, 4, "Rough Monday", ["anxious", "tired"], "manual"],
    [13, 5, null, ["tired"], "check_in"],
    [12, 4, "Couldn't sleep again", ["anxious", "restless"], "manual"],
    [11, 6, "Good call with a friend", ["hopeful", "connected"], "manual"],
    [10, 5, null, ["neutral"], "check_in"],
    [9,  7, "Finished big work task", ["accomplished", "relieved"], "post_session"],
    [8,  6, null, ["calm"], "check_in"],
    [7,  5, "Weekend but still stressed", ["anxious"], "manual"],
    [6,  6, "Went for a walk", ["calm", "hopeful"], "manual"],
    [5,  6, null, ["calm"], "post_session"],  // after session 1
    [4,  7, "Therapist session helped", ["hopeful", "reflective"], "post_session"],
    [3,  7, "Dream session — interesting", ["curious", "reflective"], "post_session"],
    [2,  7, "Gratitude journal lifted mood", ["grateful", "content"], "post_session"],
    [1,  7, null, ["calm"], "check_in"],
    [0,  8, "Good sleep! Feeling hopeful", ["hopeful", "energized", "rested"], "manual"],
  ] as const;

  for (const [days, score, note, tags, source] of moodData) {
    await addDoc(collection(db, "users", uid, "moodEntries"), {
      score,
      note: note ?? null,
      tags,
      source,
      relatedSessionId: null,
      createdAt: daysAgo(days as number),
    });
  }
  console.log("  ✓ 15 mood entries (14-day trend)");

  // ── 4. Shared Report ─────────────────────────────────────────────────────
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  await addDoc(collection(db, "sharedReports"), {
    userId: uid,
    reportData: {
      dateRange: {
        start: daysAgo(14).toDate().toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
      },
      totalSessions: 3,
      sessionBreakdown: { therapy: 2, dream_visualization: 1 },
      averageMoodScore: 6.1,
      moodTrend: [
        { date: daysAgo(14).toDate().toISOString().split("T")[0], averageScore: 4 },
        { date: daysAgo(7).toDate().toISOString().split("T")[0], averageScore: 5.8 },
        { date: new Date().toISOString().split("T")[0], averageScore: 7.5 },
      ],
      sessionSummaries: [
        {
          sessionType: "therapy",
          summary: "User discussed anxiety around upcoming project deadline. Explored cognitive reframing techniques.",
          date: daysAgo(5).toDate().toISOString().split("T")[0],
        },
        {
          sessionType: "dream_visualization",
          summary: "User visualized a peaceful forest clearing. Identified a recurring symbol of a locked door.",
          date: daysAgo(3).toDate().toISOString().split("T")[0],
        },
      ],
    },
    expiresAt: Timestamp.fromDate(expires),
    accessCount: 1,
    maxAccesses: 5,
    createdAt: daysAgo(1),
  });
  console.log("  ✓ Shared report created");

  console.log("\n✅  Seed complete! Test user UID:", uid);
  console.log("   Email:", TEST_USER_EMAIL);
  console.log("   Remember to create this user in Firebase Auth Console first.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
