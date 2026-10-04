// Run: pnpm test:hinglish
// Checks whether Gemma understands the kind of messages mummy actually sends.
import { parseMessage, MODEL } from "../src/intent.ts";

const cases: { text: string; at: string; expect: string; last?: string }[] = [
  { text: "haan beta khana kha liya", at: "13:30", expect: "meal_done" },
  { text: "abhi nashta kiya", at: "09:00", expect: "meal_done" },
  { text: "le li goli", at: "13:50", expect: "vitamin_taken" },
  { text: "vitamin kha li", at: "21:15", expect: "vitamin_taken" },
  { text: "baad mein lungi", at: "14:00", expect: "snooze" },
  { text: "10 min ruko pehle bartan dho lu", at: "14:00", expect: "snooze" },
  { text: "aaj nahi lena, pet kharab hai", at: "20:30", expect: "skip" },
  { text: "dinner ke baad tablet bhi le li", at: "21:30", expect: "vitamin_taken" },
  { text: "tum kab aa rahi ho ghar?", at: "18:00", expect: "other" },
  // short replies that only make sense with Reme's last message
  { text: "haan", at: "14:35", expect: "meal_done", last: "Mummy, lunch ho gaya? 🍽️" },
  { text: "haan", at: "14:55", expect: "vitamin_taken", last: 'Mummy, vitamin li? 🙂 Le li ho to "le li" likh dijiye' },
  { text: "nahi abhi", at: "14:55", expect: "snooze", last: 'Mummy, vitamin li? 🙂 Le li ho to "le li" likh dijiye' },
  { text: "ok", at: "13:36", expect: "other", last: "Theek hai mummy, 15 minute mein vitamin yaad dilaungi 💊" },
  { text: "acha", at: "13:21", expect: "other", last: "Theek hai, 10 minute baad yaad dilaungi" },
  { text: "haan le li", at: "14:55", expect: "vitamin_taken", last: "Mummy, vitamin le lijiye 💊" },
  // mummy's real messages, Sunday 4 Oct (first real run)
  { text: "Our Lunch ho gya", at: "14:35", expect: "meal_done" },
  { text: "Okh", at: "15:17", expect: "other" },
  { text: "Haan", at: "15:22", expect: "meal_done", last: "Mummy, lunch ho gaya? 🍽️" },
  { text: "Ok", at: "15:23", expect: "other", last: "Mummy, vitamin le lijiye 💊" },
  { text: "Ha leli", at: "15:23", expect: "vitamin_taken", last: "Mummy, vitamin le lijiye 💊" },
];

let pass = 0;
console.log(`Model: ${MODEL}\n`);
for (const c of cases) {
  const [h, m] = c.at.split(":").map(Number);
  const now = new Date();
  now.setUTCHours(h - 5, m - 30); // IST -> UTC
  const t0 = Date.now();
  const r = await parseMessage(c.text, now, c.last);
  const ok = r.intent === c.expect;
  if (ok) pass++;
  console.log(
    `${ok ? "✅" : "❌"} [${c.at}] "${c.text}"\n   → ${r.intent}` +
      (r.meal ? ` (${r.meal})` : "") +
      (r.snooze_minutes ? ` snooze=${r.snooze_minutes}m` : "") +
      `${ok ? "" : `  (expected ${c.expect})`}  ${Date.now() - t0}ms\n   reply: ${r.reply}\n`,
  );
}
console.log(`${pass}/${cases.length} correct`);
