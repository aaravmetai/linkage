// Opens from the "Turn reminders off" link in every email. A GET shows a confirm button, a POST turns reminders off.
import { FieldValue } from "firebase-admin/firestore";
import { checkToken, validUid, SITE } from "../lib/reminders-logic.mjs";
import { initAdmin, tokenKey } from "../lib/shared.mjs";

const page = (title, body, status = 200) =>
  new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f3f4f1;color:#17202b;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:420px;margin:0 auto;padding:48px 20px"><h1 style="font-size:24px;margin:0 0 12px">${title}</h1>${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

const btn = "display:inline-block;background:#17202b;color:#f3f4f1;border:0;text-decoration:none;font:600 15px sans-serif;padding:12px 22px;border-radius:999px;cursor:pointer";

export default async (req) => {
  const url = new URL(req.url);
  const uid = url.searchParams.get("u") || "";
  const t = url.searchParams.get("t") || "";
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return page("Not available", "<p>This page is not set up yet.</p>", 503);
  if (!validUid(uid) || !checkToken(uid, t, tokenKey())) {
    return page("That link is not valid", `<p>Open the account menu at <a href="${SITE}">playlinkage.com</a> and switch reminders off there.</p>`, 400);
  }
  if (req.method === "POST") {
    const { db } = initAdmin();
    await db.collection("users").doc(uid).set({ emailReminders: false, reminderUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return page("Reminders are off", `<p>You will not get any more reminder emails. You can turn them back on any time from your account at <a href="${SITE}">playlinkage.com</a>.</p>`);
  }
  return page(
    "Turn off streak reminders?",
    `<p>You will stop getting the daily reminder email.</p><form method="POST" action="${url.pathname}?u=${encodeURIComponent(uid)}&t=${encodeURIComponent(t)}"><button type="submit" style="${btn}">Turn reminders off</button></form>`
  );
};
