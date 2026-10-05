// The decision-making. Gemma tells us *what she said*; this decides *what to do*.
// No WhatsApp or Ollama here, so it can be tested with a fake clock (scripts/simulate.ts).
// One vitamin a day, after whichever of config.vitaminMeals comes first.
import { config, mealAt, MEALS, type Meal } from "./config.ts";
import type { Dose, Store } from "./db.ts";
import type { Intent } from "./intent.ts";
import { say } from "./messages.ts";

export type Send = (to: "mummy" | "alert", text: string) => Promise<void>;

const MIN = 60_000;
const CHECK_IN_WINDOW = 2 * 60 * MIN; // don't ask about lunch at midnight if the laptop was asleep

export const dateKey = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD

export class Reme {
  constructor(
    private db: Store,
    private send: Send,
    private now = () => new Date(),
  ) {}

  private dose(meal: Meal): Dose {
    const date = dateKey(this.now());
    return this.db.get(date, meal) ?? { date, meal, status: "open", reminders: 0, next_at: null };
  }

  // Which dose does "le li" / "baad mein" refer to? The latest open one today,
  // otherwise the most recent vitamin meal by the clock.
  private current(): Dose {
    const open = this.db.open(dateKey(this.now()));
    if (open.length) return open.sort((a, b) => MEALS.indexOf(b.meal) - MEALS.indexOf(a.meal))[0];
    const byClock = MEALS.indexOf(mealAt(this.now()));
    const meal = [...config.vitaminMeals].reverse().find((m) => MEALS.indexOf(m) <= byClock) ?? config.vitaminMeals[0];
    return this.dose(meal);
  }

  private after(min: number) {
    return this.now().getTime() + min * MIN;
  }

  async onMessage(i: Intent, text: string) {
    switch (i.intent) {
      case "meal_done": {
        // No meal word: she's answering the question Reme asked ("nashta ho gaya?" at 11:45,
        // "haan" at 12:05 is still breakfast). Otherwise go by the clock.
        const meal = i.meal && i.meal !== "unknown" ? i.meal : (this.db.open(dateKey(this.now()))[0]?.meal ?? mealAt(this.now()));
        this.db.log("meal_done", meal, text);
        if (!config.vitaminMeals.includes(meal)) return;
        if (this.db.settled(dateKey(this.now()))) return this.send("mummy", say.alreadyTaken);
        const d = this.dose(meal);
        if (d.reminders > 0) {
          // We already asked "lunch ho gaya?" and she said yes: she ate a while ago, remind now.
          this.db.save({ ...d, status: "open", reminders: d.reminders + 1, next_at: this.after(config.followUpMin) });
          return this.send("mummy", say.remind);
        }
        this.db.save({ ...d, status: "open", reminders: 0, next_at: this.after(config.remindAfterMin) });
        return this.send("mummy", say.willRemind(config.remindAfterMin));
      }
      case "vitamin_taken": {
        const d = this.current();
        // That's today's one dose: close any other open reminder too.
        for (const o of [d, ...this.db.open(d.date)]) this.db.save({ ...o, status: "taken", next_at: null });
        this.db.log("taken", d.meal, text);
        return this.send("mummy", say.taken);
      }
      case "snooze": {
        const d = this.current();
        if (d.status === "taken") return;
        const min = i.snooze_minutes ?? config.remindAfterMin;
        this.db.save({ ...d, status: "open", next_at: this.after(min) });
        this.db.log("snooze", d.meal, text);
        return this.send("mummy", say.snoozed(min));
      }
      case "skip": {
        const d = this.current();
        this.db.save({ ...d, status: "skipped", next_at: null });
        this.db.log("skipped", d.meal, text);
        await this.send("mummy", say.skipped);
        return this.send("alert", say.alertSkipped(d.meal, text));
      }
      default:
        // Small talk is between her and you; Reme stays quiet.
        this.db.log("other", null, text);
    }
  }

  // Called every 30 seconds.
  async tick() {
    const now = this.now();

    for (const d of this.db.due(now.getTime())) {
      if (d.reminders >= config.maxReminders) {
        this.db.save({ ...d, status: "missed", next_at: null });
        this.db.log("missed", d.meal);
        // Missed breakfast but lunch is still to come: that's her second chance, don't alarm you yet.
        const laterChance = config.vitaminMeals.some((m) => MEALS.indexOf(m) > MEALS.indexOf(d.meal) && config.checkIns[m]);
        if (!laterChance) await this.send("alert", say.alertMissed(d.meal, d.reminders));
        continue;
      }
      this.db.save({ ...d, reminders: d.reminders + 1, next_at: this.after(config.followUpMin) });
      this.db.log("reminder", d.meal);
      await this.send("mummy", d.reminders === 0 ? say.remind : say.followUp);
    }

    for (const meal of config.vitaminMeals) {
      const hm = config.checkIns[meal];
      if (!hm) continue;
      const at = new Date(now);
      at.setHours(hm[0], hm[1], 0, 0);
      const since = now.getTime() - at.getTime();
      if (since < 0 || since > CHECK_IN_WINDOW) continue;
      if (this.db.settled(dateKey(now))) break; // already taken (or skipped) today
      if (this.db.get(dateKey(now), meal)) continue; // she already told us something about this meal
      this.db.save({ date: dateKey(now), meal, status: "open", reminders: 1, next_at: this.after(config.followUpMin) });
      this.db.log("check_in", meal);
      await this.send("mummy", say.checkIn(meal));
    }
  }
}
