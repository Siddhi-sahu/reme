// Run: pnpm simulate
// Plays out a whole day with a fake clock (real Gemma, no WhatsApp) so you can
// see every message Reme would send without waiting hours.
process.env.VITAMIN_MEALS = "lunch,dinner";

const { openStore } = await import("../src/db.ts");
const { parseMessage } = await import("../src/intent.ts");
const { Reme } = await import("../src/reme.ts");

let clock = new Date();
clock.setHours(13, 0, 0, 0);
const hhmm = () => clock.toTimeString().slice(0, 5);

const reme = new Reme(
  openStore(":memory:"),
  async (to, text) => console.log(`${hhmm()}  Reme → ${to === "mummy" ? "mummy" : "YOU  "}: ${text}`),
  () => clock,
);

// What mummy types, and when
const script: Record<string, string> = {
  "13:20": "haan beta khana kha liya",
  "13:37": "10 min ruko",
  "13:50": "le li",
  // dinner: she never replies, so you should get an alert
};

for (let m = 13 * 60; m <= 23 * 60; m++) {
  clock = new Date(clock);
  clock.setHours(Math.floor(m / 60), m % 60);
  const said = script[hhmm()];
  if (said) {
    console.log(`${hhmm()}  mummy: ${said}`);
    const intent = await parseMessage(said, clock);
    console.log(`        [gemma: ${intent.intent}${intent.snooze_minutes ? ` ${intent.snooze_minutes}m` : ""}]`);
    await reme.onMessage(intent, said);
  }
  await reme.tick();
}
