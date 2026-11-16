// Logic for the streak reminder emails. No Firebase or network imports, so it can be tested on its own.
import crypto from "node:crypto";

export const EPOCH_UTC = Date.UTC(2026, 10, 12); // puzzle #1 is Nov 12, 2026, same as the game
export const SITE = "https://playlinkage.com";
const FALLBACK_TZ = "America/Chicago";

export function validTz(tz) {
  if (typeof tz !== "string" || !tz) return FALLBACK_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return FALLBACK_TZ; }
}

export function localParts(tz, date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23"
  });
  const p = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour };
}

export function puzzleNum({ y, m, d }) {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}

// A day only counts when it was finished on its own day, same rule as the game.
function live(days, n) {
  const d = days && days[n];
  return d && d.status !== "playing" && d.finishedDay === n ? d : null;
}

export function streakBefore(days, today) {
  let s = 0;
  for (let n = today - 1; n >= 1; n--) {
    const d = live(days, n);
    if (d && d.status === "won") s++; else break;
  }
  return s;
}

export function isEngaged(days, today) {
  for (let n = Math.max(1, today - 7); n < today; n++) if (live(days, n)) return true;
  return false;
}

export function decide(data, now, { hour = 19, test = false } = {}) {
  const days = data.days || {};
  const parts = localParts(validTz(data.tz), now);
  const today = puzzleNum(parts);
  if (today < 1) return { action: "skip", reason: "before launch" };
  if (test) return { action: "send", today, streak: streakBefore(days, today), test: true };
  if (data.emailReminders !== true) return { action: "skip", reason: "off" };
  if (parts.h < hour || parts.h > Math.min(hour + 2, 23)) return { action: "skip", reason: "outside window" };
  if (data.lastReminderDay === today) return { action: "skip", reason: "already sent" };
  if (live(days, today)) return { action: "skip", reason: "already played" };
  if (!isEngaged(days, today)) return { action: "skip", reason: "inactive" };
  return { action: "send", today, streak: streakBefore(days, today) };
}

export function buildEmail({ streak, unsubUrl, test = false }) {
  let subject, lead;
  if (streak >= 2) {
    subject = `Your ${streak}-day streak ends at midnight`;
    lead = `Finish today's puzzle before midnight to keep your ${streak}-day streak going.`;
  } else if (streak === 1) {
    subject = "Make it two days in a row";
    lead = "You solved yesterday's puzzle. Solve today's to start a real streak.";
  } else {
    subject = "Today's Linkage is ready";
    lead = "A fresh MCAT puzzle is waiting. Four groups, four mistakes, about two minutes.";
  }
  if (test) subject = "[Test] " + subject;
  const sq = (c) => `<span style="display:inline-block;width:22px;height:22px;border-radius:5px;background:${c};margin-right:4px"></span>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f1">
<div style="max-width:480px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17202b">
<div style="margin-bottom:14px">${sq("#f1cf63")}${sq("#9cc58a")}${sq("#93b8de")}${sq("#bc9ad8")}</div>
<h1 style="font-size:24px;line-height:1.25;margin:0 0 10px">${subject}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 22px">${lead}</p>
<a href="${SITE}" style="display:inline-block;background:#17202b;color:#f3f4f1;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Play today's puzzle</a>
<p style="font-size:12px;line-height:1.5;color:#5d6672;margin:28px 0 0">You are getting this because you turned on streak reminders at playlinkage.com. We only send it on days you have not played yet. <a href="${unsubUrl}" style="color:#5d6672">Turn reminders off</a>.</p>
</div></body></html>`;
  const text = `${lead}\n\nPlay today's puzzle: ${SITE}\n\nYou are getting this because you turned on streak reminders at playlinkage.com. Turn them off: ${unsubUrl}`;
  return { subject, html, text };
}

export const validUid = (uid) => /^[A-Za-z0-9]{10,40}$/.test(uid || "");
export const makeToken = (uid, key) => crypto.createHmac("sha256", key).update(uid).digest("base64url");
export function checkToken(uid, token, key) {
  const a = Buffer.from(makeToken(uid, key));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// db, auth and send are passed in so the whole run can be tested with fakes.
export async function runReminders({ db, auth, send, now = new Date(), env = {}, unsubUrl, from }) {
  const hour = parseInt(env.REMINDER_HOUR || "19", 10);
  const testUid = env.REMINDER_TEST_UID || "";
  let docs;
  if (testUid) {
    const d = await db.collection("users").doc(testUid).get();
    docs = d.exists ? [d] : [];
  } else {
    docs = (await db.collection("users").where("emailReminders", "==", true).get()).docs;
  }
  const summary = { considered: docs.length, queued: 0, sent: 0, failed: 0, test: !!testUid };
  const queue = [];
  for (const doc of docs) {
    const v = decide(doc.data() || {}, now, { hour, test: !!testUid });
    if (v.action !== "send") continue;
    let rec;
    try { rec = await auth.getUser(doc.id); } catch { continue; }
    if (!rec || !rec.email || !rec.emailVerified) continue;
    queue.push({ uid: doc.id, to: rec.email, today: v.today, streak: v.streak });
  }
  summary.queued = queue.length;
  for (let i = 0; i < queue.length; i += 100) {
    const chunk = queue.slice(i, i + 100);
    try {
      await send(chunk.map((q) => {
        const e = buildEmail({ streak: q.streak, unsubUrl: unsubUrl(q.uid), test: !!testUid });
        return {
          from, to: [q.to], subject: e.subject, html: e.html, text: e.text,
          headers: { "List-Unsubscribe": `<${unsubUrl(q.uid)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        };
      }));
      summary.sent += chunk.length;
      if (!testUid) await Promise.all(chunk.map((q) => db.collection("users").doc(q.uid).set({ lastReminderDay: q.today }, { merge: true })));
    } catch (e) {
      summary.failed += chunk.length;
      console.error("reminders: batch failed", String(e && e.message || e));
    }
  }
  return summary;
}
