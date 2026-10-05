// Everything about mummy's routine lives here, read from .env.
try {
  process.loadEnvFile();
} catch {
  // no .env file; fall back to defaults / real environment
}

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

export function mealAt(d: Date): Meal {
  const h = d.getHours();
  return h < 13 ? "breakfast" : h < 17 ? "lunch" : "dinner"; // mummy has breakfast at 11-11:30
}

const digits = (s = "") => s.replace(/\D/g, "");

// "breakfast=10:30,lunch=14:30" -> { breakfast: [10, 30], lunch: [14, 30] }
function parseCheckIns(s: string): Partial<Record<Meal, [number, number]>> {
  const out: Partial<Record<Meal, [number, number]>> = {};
  for (const part of s.split(",")) {
    const [meal, hm] = part.trim().split("=");
    if (MEALS.includes(meal as Meal) && hm) out[meal as Meal] = hm.split(":").map(Number) as [number, number];
  }
  return out;
}

const env = process.env;

export const config = {
  // WhatsApp numbers with country code, e.g. 919876543210
  mummyNumber: digits(env.MUMMY_NUMBER),
  alertNumber: digits(env.ALERT_NUMBER), // you: gets told when a dose is missed or skipped

  // Once a day, after whichever of these meals comes first (mummy: breakfast only)
  vitaminMeals: (env.VITAMIN_MEALS ?? "breakfast").split(",").map((m) => m.trim()) as Meal[],

  // If she hasn't said anything by this time, ask her
  checkIns: parseCheckIns(env.CHECKINS ?? "breakfast=11:45,lunch=14:30"),

  remindAfterMin: Number(env.REMIND_AFTER_MIN ?? 15), // after she says she has eaten
  followUpMin: Number(env.FOLLOW_UP_MIN ?? 20), // gap between nudges
  maxReminders: Number(env.MAX_REMINDERS ?? 3), // then alert you instead of nagging her
};
