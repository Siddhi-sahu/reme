import ollama from "ollama";
import { z } from "zod";
import { mealAt, type Meal } from "./config.ts";

export const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

// What Gemma must return for every message mum sends.
export const Intent = z.object({
  intent: z.enum([
    "meal_done", // "khana kha liya?"
    "vitamin_taken", // "le li", "kha li goli"
    "snooze", // "baad mein lungi", "10 min ruko"
    "skip", // "aaj nahi lena"
    "other", // greetings, questions, anything else
  ]),
  meal: z.enum(["breakfast", "lunch", "dinner", "unknown"]).nullable(),
  snooze_minutes: z.number().int().nullable(),
  reply: z.string(), // short warm reply in the same language she used
});
export type Intent = z.infer<typeof Intent>;

const SYSTEM = `You are "Reme", a gentle helper that reminds an Indian mother to take her multivitamin after meals.
She writes in Hindi, Hinglish (Hindi in Latin script) or simple English, often with typos.

Classify her message:
- meal_done: she has just eaten (breakfast/nashta, lunch/dopahar ka khana, dinner/raat ka khana).
- vitamin_taken: she has taken the vitamin/tablet/goli/dawai.
- snooze: she asks to wait or will take it later, even if she gives a reason (ruko, wait, baad mein, thodi der, "10 min"). Put the delay in snooze_minutes if she says one, else null.
- skip: she will not take it today.
- other: anything else.

If both eating and taking the vitamin are mentioned, choose vitamin_taken.
Short answers like "haan", "ho gaya", "ok", "nahi" answer YOUR LAST MESSAGE to her (given below):
"haan" to "vitamin li?" is vitamin_taken; "haan" to "lunch ho gaya?" is meal_done; "nahi" to "vitamin li?" is snooze.
"ok", "acha", "theek hai", "👍" that just acknowledge your message are other.
Only choose vitamin_taken if she clearly says she took it, or says yes to you asking whether she took it.
meal: which meal she means if you can tell from words or the current time, else "unknown". Null if not about a meal.
reply: one short, warm, respectful sentence in the SAME language and script she used (Latin letters in, Latin letters out). Call her "mummy". No lecturing.

Examples:
"khana ho gaya" -> {"intent":"meal_done","meal":"unknown","snooze_minutes":null,"reply":"Bahut badhiya mummy! Thodi der mein vitamin yaad dilaungi."}
"5 min ruko, phone pe hu" -> {"intent":"snooze","meal":null,"snooze_minutes":5,"reply":"Theek hai mummy, 5 minute baad yaad dilaungi."}
"le li beta" -> {"intent":"vitamin_taken","meal":null,"snooze_minutes":null,"reply":"Shabaash mummy! 💊"}`;

// Which meal: the word she used, else the clock. Gemma once called "Our Lunch ho gya" at 2:35pm dinner.
const MEAL_WORDS: [RegExp, Meal][] = [
  [/nasht|breakfast/i, "breakfast"],
  [/lunch|dopahar/i, "lunch"],
  [/dinner|raat/i, "dinner"],
];

const ACK = /^(ok+h?|okay|k|acha+|achha+|accha+|theek hai|thik hai|ji|hmm+|👍|🙏)[.!\s]*$/i;

export async function parseMessage(text: string, now = new Date(), lastSent?: string): Promise<Intent> {
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const res = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Current time: ${time}\nYour last message to her: ${lastSent ?? "(none)"}\nHer message: ${text}` },
    ],
    format: z.toJSONSchema(Intent),
    options: { temperature: 0 },
  });
  const parsed = Intent.parse(JSON.parse(res.message.content));
  if (parsed.intent === "meal_done") parsed.meal = MEAL_WORDS.find(([re]) => re.test(text))?.[1] ?? mealAt(now);
  // A delay with no other intent means "remind me later".
  if (parsed.intent === "other" && parsed.snooze_minutes) parsed.intent = "snooze";
  // "ok" to "15 minute mein yaad dilaungi" is not "I took it". Marking it taken would
  // silently stop the reminders, so don't trust the model here.
  if (ACK.test(text.trim()) && !lastSent?.includes("?")) parsed.intent = "other";
  return parsed;
}
