# Reme

*Remember me.* A WhatsApp nudge that reminds my mummy to take her daily multivitamin after breakfast, in Hinglish, from my own number.

It understands her replies ("Haan", "Ha leli", "10 min ruko", "aaj nahi lena") with **Gemma 3 4B running locally through Ollama**, so her messages never leave my laptop.

```
15:20  Reme → mummy: Mummy, lunch ho gaya? 🍽️
15:22  mummy: Haan                     [gemma: meal_done]
15:23  Reme → mummy: Mummy, vitamin le lijiye 💊
15:23  mummy: Ok                       [ignored: just an acknowledgement]
15:23  mummy: Ha leli                  [gemma: vitamin_taken]
15:23  Reme → mummy: Shabaash mummy! 💊❤️
```
*(the first real run, 4 Oct 2026)*

## How it works

- **One vitamin a day, after breakfast** (she eats around 11 to 11:30). Once it's taken, Reme goes quiet for the day.
- **She messages first** ("nashta ho gaya"): Reme reminds her 15 minutes later.
- **She doesn't**: at 11:45 Reme asks "nashta ho gaya?", then nudges every 20 minutes.
- Configurable: `VITAMIN_MEALS=breakfast,lunch` makes lunch a second chance if breakfast passes with no reply.
- **Snooze / skip** are understood ("baad mein", "10 min ruko", "aaj nahi").
- **After 3 unanswered nudges**, it stops nagging her and messages me instead: *"Ek call kar lo?"*
- **Small talk is ignored.** Reme only speaks up about the vitamin; everything else is between her and me.

Gemma's job is narrow: turn her message into an intent (`meal_done`, `vitamin_taken`, `snooze`, `skip`, `other`). Plain code decides what to do, and every message she receives is written by hand in [`src/messages.ts`](src/messages.ts). Gemma also sees Reme's last message, so a bare "haan" means the right thing.

| File | Job |
|---|---|
| `src/intent.ts` | Gemma prompt + JSON schema, plus guards for mistakes the model kept making |
| `src/reme.ts` | What to do for each intent, and the 30-second clock tick |
| `src/messages.ts` | Every message she receives |
| `src/db.ts` | SQLite (built into Node): one row per dose per day, survives restarts |
| `src/whatsapp.ts` | WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys) |

## Run it

Needs Node 22+, pnpm and [Ollama](https://ollama.com).

```bash
ollama pull gemma3:4b
pnpm install
cp .env.example .env          # her number, your number, which meal
caffeinate -i pnpm start      # scan the QR: WhatsApp → Linked devices → Link a device
```

Keep it running (and Ollama open) through the check-in time. `DEBUG=1` logs which chat each incoming message came from.

## Tests

```bash
pnpm test:hinglish   # 28 messages, incl. mummy's real ones, through Gemma
pnpm simulate        # five whole mornings with a fake clock, no WhatsApp
```

How accuracy changed as the prompt and guards improved is in [`results/`](results/): 8/9 → 9/9 → 15/15 (with conversation context) → 20/20 → 28/28 (with her real messages).

## Privacy and caveats

- Her messages go to Gemma **on my laptop**. No cloud AI sees them, there is no API bill, and the model can be swapped.
- Reme runs as a *linked device* on my WhatsApp. `auth/` holds that login: never share or commit it. To revoke: WhatsApp → Linked devices → Log out, then delete `auth/`.
- Baileys is an unofficial WhatsApp client. Fine for a few messages a day to family; not something to scale.
- It only works while my laptop is awake. The next step is moving it to an always-on box.
