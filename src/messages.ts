// Every message mummy receives is written here by hand, not by the model.
// Gemma only decides *which* one to send.
import type { Meal } from "./config.ts";

const mealName: Record<Meal, string> = { breakfast: "nashta", lunch: "lunch", dinner: "dinner" };

export const say = {
  checkIn: (meal: Meal) => `Mummy, ${mealName[meal]} ho gaya? 🍽️`, // one question only, so "haan" is never ambiguous
  willRemind: (min: number) => `Theek hai mummy, ${min} minute mein vitamin yaad dilaungi 💊`,
  remind: "Mummy, vitamin le lijiye 💊",
  followUp: 'Mummy, vitamin li? 🙂 Le li ho to "le li" likh dijiye',
  taken: "Shabaash mummy! 💊❤️",
  alreadyTaken: "Aaj ki vitamin to ho gayi mummy 👍",
  snoozed: (min: number) => `Theek hai, ${min} minute baad yaad dilaungi`,
  skipped: "Theek hai mummy, apna dhyan rakhna 🙏",

  // to you
  alertMissed: (meal: Meal, n: number) =>
    `Reme: mummy ne ${mealName[meal]} ke baad vitamin nahi li. ${n} reminder bheje, koi reply nahi. Ek call kar lo?`,
  alertSkipped: (meal: Meal, text: string) => `Reme: mummy ne aaj ${mealName[meal]} ke baad vitamin skip ki: "${text}"`,
};
