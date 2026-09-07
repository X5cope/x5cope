// ==========================================================================
// Firebase config — replace with YOUR project's values
// Get these from: Firebase Console → Project Settings → General → Your apps
// (This file is safe to be public, these are not secret keys, security is
// enforced by Firestore rules, not by hiding this config.)
// ==========================================================================

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// Emails that get "master" access — sees every conversation, not just their own.
// Add one email per line for each team member who should see the shared inbox
// (you, your friend, your brother, your coder friend, etc.)
export const ADMIN_EMAILS = [
  "x5cope322@gmail.com"
];
 
