// Run: pnpm simulate
// Plays out a whole day with a fake clock (real Gemma, no WhatsApp) so you can
// see every message Reme would send without waiting hours.
process.env.VITAMIN_MEALS = "lunch";
process.env.CHECKINS = "lunch=14:30";

const { openStore } = await import("../src/db.ts");
const { parseMessage } = await import("../src/intent.ts");
const { Reme } = await import("../src/reme.ts");

let clock = new Date();
clock.setHours(12, 0, 0, 0);
const hhmm = () => clock.toTimeString().slice(0, 5);

let lastToMummy: string | undefined;

async function day(title: string, script: Record<string, string>) {
  console.log(`\n=== ${title} ===`);
  const reme = new Reme(
    openStore(":memory:"),
    async (to, text) => {
      if (to === "mummy") lastToMummy = text;
      console.log(`${hhmm()}  Reme → ${to === "mummy" ? "mummy" : "YOU  "}: ${text}`);
    },
    () => clock,
  );
  for (let m = 12 * 60; m <= 17 * 60; m++) {
    clock = new Date(clock);
    clock.setHours(Math.floor(m / 60), m % 60);
    const said = script[hhmm()];
    if (said) {
      console.log(`${hhmm()}  mummy: ${said}`);
      const intent = await parseMessage(said, clock, lastToMummy);
      console.log(`        [gemma: ${intent.intent}${intent.snooze_minutes ? ` ${intent.snooze_minutes}m` : ""}]`);
      await reme.onMessage(intent, said);
    }
    await reme.tick();
  }
}

await day("She messages after lunch", { "13:20": "haan beta khana kha liya", "13:37": "10 min ruko", "13:50": "le li" });
await day("Reme asks first, she answers 'haan'", { "14:33": "haan", "14:52": "haan le li" });
await day("She never replies", {});
