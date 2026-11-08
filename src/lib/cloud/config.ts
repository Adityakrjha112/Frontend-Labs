/**
 * Firebase web configuration from NEXT_PUBLIC_* environment variables.
 * These values are public by design (they identify the project); access is
 * controlled by database.rules.json, which limits each user to their own data.
 * Without them the app runs local-only and hides sign-in.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Kept for completeness; Analytics is not initialised (see README).
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** "host:port" pairs for the Firebase Emulator Suite (local testing only). */
export const emulators = {
  auth: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR ?? "",
  database: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_EMULATOR ?? "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.databaseURL && firebaseConfig.projectId,
);

/** Where each user's data lives in the Realtime Database. */
export const userPath = (uid: string, store: "practice" | "roadmap") => `users/${uid}/${store}`;
