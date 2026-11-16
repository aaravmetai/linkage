// Runs every hour. Emails opted-in players who have not played yet, once per day, in the 7pm hour of their own time zone.
import { runReminders } from "../lib/reminders-logic.mjs";
import { initAdmin, unsubUrlFor } from "../lib/shared.mjs";

export const config = { schedule: "@hourly" };

async function sendViaResend(payloads) {
  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payloads)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

export default async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.RESEND_API_KEY) {
    console.log("reminders: FIREBASE_SERVICE_ACCOUNT or RESEND_API_KEY is not set, nothing sent");
    return new Response("not configured");
  }
  const { db, auth } = initAdmin();
  const summary = await runReminders({
    db, auth, send: sendViaResend, now: new Date(), env: process.env, unsubUrl: unsubUrlFor,
    from: process.env.REMINDER_FROM || "Linkage <reminders@playlinkage.com>"
  });
  console.log("reminders:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary));
};
