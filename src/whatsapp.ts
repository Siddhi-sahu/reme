// WhatsApp via Baileys: talks to WhatsApp Web's protocol directly (no browser).
// First run prints a QR code; scan it from WhatsApp > Linked devices.
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, type WAMessage, type WASocket } from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

const AUTH_DIR = "auth"; // login session; never commit this

// libsignal (Baileys' encryption library) prints whole session objects, including
// private keys, via console.info/warn. Reme only uses console.log/error, so mute these.
console.info = () => {};
const warn = console.warn;
console.warn = (msg?: unknown, ...rest: unknown[]) => {
  if (typeof msg === "string" && msg.startsWith("Session")) return;
  warn(msg, ...rest);
};

export type Incoming = { from: string; text?: string; isVoice: boolean };

let sock: WASocket | undefined; // replaced on every reconnect

export async function sendText(phone: string, text: string) {
  if (!sock) throw new Error("WhatsApp not connected");
  await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
}

const phoneOf = (jid?: string | null) => (jid?.endsWith("@s.whatsapp.net") ? jid.split("@")[0].split(":")[0] : undefined);

// WhatsApp may address a chat by a private id (@lid) instead of the phone number.
// Try the alternate id first, then ask Baileys' lid -> phone mapping.
async function senderPhone(m: WAMessage) {
  const direct = phoneOf(m.key.remoteJid) ?? phoneOf(m.key.remoteJidAlt);
  if (direct || !m.key.remoteJid?.endsWith("@lid")) return direct;
  return phoneOf(await sock?.signalRepository.lidMapping.getPNForLID(m.key.remoteJid));
}

export async function connectWhatsApp(onMessage: (m: Incoming) => void, onReady: () => void) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }) });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this with WhatsApp → Settings → Linked devices → Link a device:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("✓ WhatsApp connected");
      onReady();
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log(`Logged out. Delete the ${AUTH_DIR}/ folder and run again to re-scan.`);
        process.exit(1);
      }
      console.log(`Connection closed (${code}), reconnecting…`);
      void connectWhatsApp(onMessage, onReady);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return; // ignore old history being synced
    for (const m of messages) {
      if (m.key.fromMe) continue; // our own messages (and anything you type yourself)
      const from = await senderPhone(m);
      if (process.env.DEBUG) console.log(`[debug] message in chat ${m.key.remoteJid} (alt ${m.key.remoteJidAlt}) -> ${from}`);
      if (!from) continue; // groups, status, channels
      const msg = m.message;
      onMessage({
        from,
        text: msg?.conversation ?? msg?.extendedTextMessage?.text ?? undefined,
        isVoice: !!msg?.audioMessage,
      });
    }
  });
}
