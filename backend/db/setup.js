import bcrypt from "bcryptjs";
import { openDb, run, get } from "./db.js";

const db = openDb();

async function setup() {
  // Tables
  await run(db, `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','facility','cleaner','user'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS ticket_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      default_assignee_role TEXT NOT NULL CHECK(default_assignee_role IN ('admin','facility','cleaner'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','CLOSED')) DEFAULT 'OPEN',
      priority TEXT NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')) DEFAULT 'MEDIUM',
      floor INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      assigned_role TEXT NOT NULL CHECK(assigned_role IN ('admin','facility','cleaner')),
      type_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by_user_id) REFERENCES users(id),
      FOREIGN KEY(type_id) REFERENCES ticket_types(id)
    );
  `);

  // Seed users (idempotent)
  const seedUsers = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "facility", password: "facility123", role: "facility" },
    { username: "cleaner", password: "cleaner123", role: "cleaner" },
    { username: "user", password: "user123", role: "user" }
  ];

  for (const u of seedUsers) {
    const existing = await get(db, "SELECT id FROM users WHERE username = ?", [u.username]);
    if (!existing) {
      const hash = bcrypt.hashSync(u.password, 10);
      await run(db, "INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", [u.username, hash, u.role]);
    }
  }

  // Seed ticket types (idempotent)
  const seedTypes = [
    ["Plumbing issue", "facility"],
    ["Electrical issue", "facility"],
    ["HVAC / Air conditioning", "facility"],
    ["Furniture damage", "facility"],
    ["Cleaning request", "cleaner"],
    ["Trash / waste issue", "cleaner"],
    ["Restroom cleaning", "cleaner"],
    ["IT / Network", "facility"],
    ["Access badge / Door", "facility"],
    ["Security concern", "facility"],
    ["Other", "admin"]
  ];

  for (const [name, role] of seedTypes) {
    const existing = await get(db, "SELECT id FROM ticket_types WHERE name = ?", [name]);
    if (!existing) {
      await run(db, "INSERT INTO ticket_types (name, default_assignee_role) VALUES (?,?)", [name, role]);
    }
  }

  console.log("✅ Database setup complete (users + ticket types seeded).");
  db.close();
}

setup().catch((e) => {
  console.error("❌ DB setup failed:", e);
  db.close();
  process.exit(1);
});
