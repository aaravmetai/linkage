// Firebase Admin setup and unsubscribe links, shared by both functions.
import crypto from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { makeToken, SITE } from "./reminders-logic.mjs";

let sa;
function serviceAccount() {
  if (sa) return sa;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  sa = JSON.parse(text);
  sa.private_key = String(sa.private_key || "").replace(/\\n/g, "\n");
  return sa;
}

export function initAdmin() {
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount()) });
  return { db: getFirestore(), auth: getAuth() };
}

// Links are signed with a key derived from the service account, so no extra secret is needed.
const tokenKey = () => crypto.createHash("sha256").update(serviceAccount().private_key).digest();
export const signUid = (uid) => makeToken(uid, tokenKey());
export const unsubUrlFor = (uid) => `${SITE}/.netlify/functions/unsubscribe?u=${encodeURIComponent(uid)}&t=${signUid(uid)}`;
export { tokenKey };
