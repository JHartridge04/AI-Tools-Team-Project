/**
 * clearTestData.ts — Removes all seeded test data from Firestore.
 *
 * HOW TO RUN:
 *   npx ts-node scripts/clearTestData.ts
 *
 * ⚠️  This permanently deletes data. Only run against a dev/test project.
 *     Set TEST_USER_UID to the same UID you used in seedData.ts.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// ⚠️  Must match the UID used in seedData.ts
const TEST_USER_UID = "REPLACE_WITH_TEST_USER_UID";

async function clear() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const uid = TEST_USER_UID;

  console.log("🧹  Clearing test data for UID:", uid);

  // Delete messages within each session first (Firestore requires subcollection cleanup)
  const sessionsSnap = await getDocs(collection(db, "users", uid, "sessions"));
  for (const sessionDoc of sessionsSnap.docs) {
    const msgSnap = await getDocs(
      collection(db, "users", uid, "sessions", sessionDoc.id, "messages")
    );
    await Promise.all(msgSnap.docs.map((m) => deleteDoc(m.ref)));
    await deleteDoc(sessionDoc.ref);
    console.log(`  ✓ Deleted session ${sessionDoc.id} and its messages`);
  }

  // Delete mood entries
  const moodSnap = await getDocs(collection(db, "users", uid, "moodEntries"));
  await Promise.all(moodSnap.docs.map((d) => deleteDoc(d.ref)));
  console.log(`  ✓ Deleted ${moodSnap.size} mood entries`);

  // Delete shared reports owned by this user
  const reportsSnap = await getDocs(
    query(collection(db, "sharedReports"), where("userId", "==", uid))
  );
  await Promise.all(reportsSnap.docs.map((d) => deleteDoc(d.ref)));
  console.log(`  ✓ Deleted ${reportsSnap.size} shared reports`);

  // Delete user profile
  await deleteDoc(doc(db, "users", uid));
  console.log("  ✓ Deleted user profile");

  console.log("\n✅  Test data cleared.");
  process.exit(0);
}

clear().catch((err) => {
  console.error("❌  Clear failed:", err);
  process.exit(1);
});
