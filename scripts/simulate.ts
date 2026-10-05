// Run: pnpm simulate
// Plays out a whole day with a fake clock (real Gemma, no WhatsApp) so you can
// see every message Reme would send without waiting hours.
process.env.VITAMIN_MEALS = "breakfast";
process.env.CHECKINS = "breakfast=11:45";

const { openStore } = await import("../src/db.ts");
const { parseMessage } = await import("../src/intent.ts");
const { Reme } = await import("../src/reme.ts");

let clock = new Date();
clock.setHours(8, 0, 0, 0);
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
  for (let m = 8 * 60; m <= 17 * 60; m++) {
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

await day("She tells Reme after breakfast", { "11:20": "nashta ho gaya", "11:36": "le li" });
await day("Reme asks, she answers 'haan' after 12", { "12:05": "haan", "12:12": "Ha leli" });
await day("The classic: lelungi baad mein", { "11:48": "haan", "11:49": "lelungi baad mein", "12:10": "le li" });
await day("Not today", { "11:50": "aaj nahi lena, pet kharab hai" });
await day("She never replies", {});
