# Ticketing Manager (DB + Priorities + Floors + GitHub Pages frontend)

This repo contains:
- **backend/**: Express API + SQLite database + JWT auth
- **frontend/**: Static site (HTML/CSS/JS) that works on **GitHub Pages** and talks to the API via `API_BASE_URL`

> GitHub Pages can only host the **frontend**. The backend must be hosted elsewhere (Render/Fly.io/Railway/VPS), or run locally.

---

## Demo users (seeded in DB)

| Role | Username | Password |
|---|---|---|
| Admin | admin | admin123 |
| Facility | facility | facility123 |
| Cleaner | cleaner | cleaner123 |
| User | user | user123 |

---

## Ticket routing (auto-assignment by type)

- Plumbing / Electrical / HVAC / Furniture  -> **facility**
- Cleaning request / Trash / Restroom       -> **cleaner**
- IT / Access badge / Security             -> **facility** (change in DB if you want)
- Other                                    -> **admin**

---

## Floors

Floors are integers from **-3 to 6**.

## Priorities

**LOW, MEDIUM, HIGH, URGENT**

---

# 1) Run locally

### Backend
```bash
cd backend
npm install
npm run db:setup
npm run dev
```

API will be at: `http://localhost:3000`

### Frontend
Option A (quick): open `frontend/index.html` in a browser and set `API_BASE_URL` to your backend in `frontend/config.js`.

Option B (recommended): serve static files:
```bash
cd frontend
npx http-server -p 5173
```

Then open: `http://localhost:5173`

---

# 2) Deploy backend (for GitHub Pages)

You can deploy the **backend** to:
- Render
- Railway
- Fly.io
- a VPS

Environment variables (backend):
- `PORT` (optional)
- `JWT_SECRET` (required in production)
- `CORS_ORIGIN` (set to your GitHub Pages URL, e.g. `https://YOURNAME.github.io/REPO`)

For SQLite on hosted platforms: some providers have ephemeral disks. For production use Postgres instead.
This demo uses SQLite for simplicity.

---

# 3) Deploy frontend to GitHub Pages

1. Push this repo to GitHub.
2. In `frontend/config.js`, set:
   - `API_BASE_URL` to your deployed backend URL.
3. In GitHub:
   - Settings → Pages → Build and deployment → **Deploy from a branch**
   - Select branch `main` and folder `/frontend`
4. Open your Pages URL.

---

# API quick reference

- `POST /api/auth/login`
- `GET /api/ticket-types`
- `GET /api/tickets` (role-based)
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `DELETE /api/tickets/:id` (admin only)

---

If you want, I can also provide:
- Postgres version (for real hosting)
- Admin UI for managing users + ticket types
- Email/Teams notifications
