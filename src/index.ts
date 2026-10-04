// Run: pnpm start
import { config } from "./config.ts";
import { openStore } from "./db.ts";
import { MODEL, parseMessage } from "./intent.ts";
import { Reme } from "./reme.ts";
import { connectWhatsApp, sendText, type Incoming } from "./whatsapp.ts";

if (!config.mummyNumber || !config.alertNumber) {
  console.error("Set MUMMY_NUMBER and ALERT_NUMBER in .env (see .env.example)");
  process.exit(1);
}

const time = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

let lastToMummy: string | undefined; // so Gemma knows what "haan" is answering

const reme = new Reme(openStore(), async (to, text) => {
  console.log(`${time()} → ${to}: ${text}`);
  if (to === "mummy") lastToMummy = text;
  await sendText(to === "mummy" ? config.mummyNumber : config.alertNumber, text);
});

async function onMessage({ from, text, isVoice }: Incoming) {
  if (from !== config.mummyNumber) return;
  if (isVoice) return console.log(`${time()} mummy sent a voice note (not supported yet)`);
  if (!text) return;
  try {
    const intent = await parseMessage(text, new Date(), lastToMummy);
    console.log(`${time()} mummy: "${text}" → ${intent.intent}${intent.meal ? ` (${intent.meal})` : ""}`);
    await reme.onMessage(intent, text);
  } catch (err) {
    console.error(`${time()} could not handle "${text}":`, err);
  }
}

let ticking: NodeJS.Timeout | undefined;
function onReady() {
  ticking ??= setInterval(() => reme.tick().catch((e) => console.error("tick failed:", e)), 30_000);
}

console.log(`Reme starting with ${MODEL}. Vitamin after: ${config.vitaminMeals.join(", ")}`);
await connectWhatsApp(onMessage, onReady);
