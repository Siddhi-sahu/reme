// One row per dose per day, stored in SQLite (built into Node, no server needed),
// so reminders survive the laptop restarting.
import { DatabaseSync } from "node:sqlite";
import type { Meal } from "./config.ts";

export type Dose = {
  date: string; // YYYY-MM-DD, local time
  meal: Meal;
  status: "open" | "taken" | "skipped" | "missed";
  reminders: number; // nudges sent so far
  next_at: number | null; // ms timestamp of the next nudge
};

export function openStore(path = "reme.db") {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS doses (
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      status TEXT NOT NULL,
      reminders INTEGER NOT NULL DEFAULT 0,
      next_at INTEGER,
      PRIMARY KEY (date, meal)
    );
    CREATE TABLE IF NOT EXISTS log (
      at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      event TEXT NOT NULL,
      meal TEXT,
      detail TEXT
    );
  `);

  const getStmt = db.prepare("SELECT * FROM doses WHERE date = ? AND meal = ?");
  const saveStmt = db.prepare(`
    INSERT INTO doses (date, meal, status, reminders, next_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (date, meal) DO UPDATE SET status = excluded.status, reminders = excluded.reminders, next_at = excluded.next_at
  `);
  const openStmt = db.prepare("SELECT * FROM doses WHERE date = ? AND status = 'open'");
  const settledStmt = db.prepare("SELECT 1 FROM doses WHERE date = ? AND status IN ('taken', 'skipped') LIMIT 1");
  const dueStmt = db.prepare("SELECT * FROM doses WHERE status = 'open' AND next_at <= ?");
  const logStmt = db.prepare("INSERT INTO log (event, meal, detail) VALUES (?, ?, ?)");

  return {
    get: (date: string, meal: Meal) => getStmt.get(date, meal) as Dose | undefined,
    save: (d: Dose) => void saveStmt.run(d.date, d.meal, d.status, d.reminders, d.next_at),
    open: (date: string) => openStmt.all(date) as Dose[],
    // once a day: has today's vitamin been taken or deliberately skipped?
    settled: (date: string) => !!settledStmt.get(date),
    due: (nowMs: number) => dueStmt.all(nowMs) as Dose[],
    log: (event: string, meal: Meal | null = null, detail: string | null = null) => void logStmt.run(event, meal, detail),
  };
}

export type Store = ReturnType<typeof openStore>;
