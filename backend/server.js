import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { openDb, get, all, run } from "./db/db.js";
import { requireAuth } from "./auth.js";
import { canViewTicket, canEditTicket, canDeleteTicket } from "./permissions.js";

const app = express();
const db = openDb();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({
  origin: CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: false
}));
app.use(express.json());

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Auth: login -> JWT
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const user = await get(db, "SELECT id, username, password_hash, role FROM users WHERE username = ?", [username]);
  if (!user) return res.status(401).json({ error: "Invalid login" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid login" });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Ticket types
app.get("/api/ticket-types", requireAuth, async (_req, res) => {
  const rows = await all(db, "SELECT id, name, default_assignee_role FROM ticket_types ORDER BY name");
  res.json(rows);
});

// List tickets (role-based)
app.get("/api/tickets", requireAuth, async (req, res) => {
  const user = req.user;

  const rows = await all(db, `
    SELECT
      t.id, t.title, t.description, t.status, t.priority, t.floor,
      t.assigned_role, t.created_at, t.updated_at,
      tt.name AS type_name,
      u.username AS created_by
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
    JOIN users u ON u.id = t.created_by_user_id
    ORDER BY t.id DESC
  `);

  const filtered = rows.filter(r => {
    // For permission checks we need created_by_user_id; fetch minimally
    // We'll re-fetch per ticket only when needed would be slow; instead include it:
    return true;
  });

  // Re-query with created_by_user_id included for correct filtering
  const rows2 = await all(db, `
    SELECT
      t.id, t.title, t.description, t.status, t.priority, t.floor,
      t.assigned_role, t.created_at, t.updated_at,
      t.created_by_user_id,
      tt.name AS type_name,
      u.username AS created_by
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
    JOIN users u ON u.id = t.created_by_user_id
    ORDER BY t.id DESC
  `);

  const visible = rows2.filter(r => canViewTicket(user, r)).map(r => {
    const { created_by_user_id, ...rest } = r;
    return rest;
  });

  res.json(visible);
});

// Create ticket (auto-assign by type)
app.post("/api/tickets", requireAuth, async (req, res) => {
  const user = req.user;
  const { title, description, type_id, priority, floor } = req.body || {};

  if (!title || !description || !type_id) return res.status(400).json({ error: "title, description, type_id required" });

  // Validate floor
  const fl = Number(floor);
  if (!Number.isInteger(fl) || fl < -3 || fl > 6) return res.status(400).json({ error: "floor must be an integer between -3 and 6" });

  // Validate priority
  const pr = (priority || "MEDIUM").toUpperCase();
  if (!["LOW","MEDIUM","HIGH","URGENT"].includes(pr)) return res.status(400).json({ error: "invalid priority" });

  const tt = await get(db, "SELECT id, default_assignee_role FROM ticket_types WHERE id = ?", [type_id]);
  if (!tt) return res.status(400).json({ error: "invalid ticket type" });

  // Auto assignment based on ticket type
  const assigned_role = tt.default_assignee_role;

  const now = new Date().toISOString();
  const result = await run(db, `
    INSERT INTO tickets (title, description, status, priority, floor, created_by_user_id, assigned_role, type_id, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `, [title, description, "OPEN", pr, fl, user.id, assigned_role, tt.id, now, now]);

  const created = await get(db, `
    SELECT
      t.id, t.title, t.description, t.status, t.priority, t.floor,
      t.assigned_role, t.created_at, t.updated_at,
      tt.name AS type_name,
      u.username AS created_by
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
    JOIN users u ON u.id = t.created_by_user_id
    WHERE t.id = ?
  `, [result.lastID]);

  res.status(201).json(created);
});

// Update ticket (role-based)
app.patch("/api/tickets/:id", requireAuth, async (req, res) => {
  const user = req.user;
  const id = Number(req.params.id);

  const ticket = await get(db, `
    SELECT
      t.*,
      tt.name AS type_name
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
    WHERE t.id = ?
  `, [id]);

  if (!ticket) return res.sendStatus(404);
  if (!canEditTicket(user, ticket)) return res.status(403).json({ error: "Forbidden" });

  const updates = {};
  if (req.body.status) updates.status = String(req.body.status).toUpperCase();
  if (req.body.description !== undefined) updates.description = String(req.body.description);
  if (req.body.priority) updates.priority = String(req.body.priority).toUpperCase();
  if (req.body.floor !== undefined) updates.floor = Number(req.body.floor);

  if (updates.status && !["OPEN","IN_PROGRESS","CLOSED"].includes(updates.status)) {
    return res.status(400).json({ error: "invalid status" });
  }
  if (updates.priority && !["LOW","MEDIUM","HIGH","URGENT"].includes(updates.priority)) {
    return res.status(400).json({ error: "invalid priority" });
  }
  if (updates.floor !== undefined) {
    if (!Number.isInteger(updates.floor) || updates.floor < -3 || updates.floor > 6) {
      return res.status(400).json({ error: "floor must be an integer between -3 and 6" });
    }
  }

  const fields = Object.keys(updates);
  if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

  const now = new Date().toISOString();
  updates.updated_at = now;

  const setSql = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const params = [...Object.values(updates), id];

  await run(db, `UPDATE tickets SET ${setSql} WHERE id = ?`, params);

  const updated = await get(db, `
    SELECT
      t.id, t.title, t.description, t.status, t.priority, t.floor,
      t.assigned_role, t.created_at, t.updated_at,
      tt.name AS type_name,
      u.username AS created_by
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
    JOIN users u ON u.id = t.created_by_user_id
    WHERE t.id = ?
  `, [id]);

  res.json(updated);
});

// Delete ticket (admin only)
app.delete("/api/tickets/:id", requireAuth, async (req, res) => {
  const user = req.user;
  if (!canDeleteTicket(user)) return res.status(403).json({ error: "Admin only" });

  const id = Number(req.params.id);
  await run(db, "DELETE FROM tickets WHERE id = ?", [id]);
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(`🔐 CORS origin(s): ${CORS_ORIGIN}`);
});
