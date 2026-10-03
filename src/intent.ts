import ollama from "ollama";
import { z } from "zod";

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
meal: which meal she means if you can tell from words or the current time, else "unknown". Null if not about a meal.
reply: one short, warm, respectful sentence in the SAME language and script she used (Latin letters in, Latin letters out). Call her "mummy". No lecturing.

Examples:
"khana ho gaya" -> {"intent":"meal_done","meal":"unknown","snooze_minutes":null,"reply":"Bahut badhiya mummy! Thodi der mein vitamin yaad dilaungi."}
"5 min ruko, phone pe hu" -> {"intent":"snooze","meal":null,"snooze_minutes":5,"reply":"Theek hai mummy, 5 minute baad yaad dilaungi."}
"le li beta" -> {"intent":"vitamin_taken","meal":null,"snooze_minutes":null,"reply":"Shabaash mummy! 💊"}`;

export async function parseMessage(text: string, now = new Date()): Promise<Intent> {
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const res = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Current time: ${time}\nMessage: ${text}` },
    ],
    format: z.toJSONSchema(Intent),
    options: { temperature: 0 },
  });
  const parsed = Intent.parse(JSON.parse(res.message.content));
  // A delay with no other intent means "remind me later".
  if (parsed.intent === "other" && parsed.snooze_minutes) parsed.intent = "snooze";
  return parsed;
}
