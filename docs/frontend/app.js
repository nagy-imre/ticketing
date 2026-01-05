const API = (path) => `${window.API_BASE_URL}${path}`;

const els = {
  loginCard: document.getElementById("loginCard"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginError: document.getElementById("loginError"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  whoami: document.getElementById("whoami"),

  app: document.getElementById("app"),
  typeSelect: document.getElementById("typeSelect"),
  title: document.getElementById("title"),
  description: document.getElementById("description"),
  priority: document.getElementById("priority"),
  floor: document.getElementById("floor"),
  createBtn: document.getElementById("createBtn"),
  createError: document.getElementById("createError"),
  refreshBtn: document.getElementById("refreshBtn"),
  tickets: document.getElementById("tickets"),

  backdrop: document.getElementById("modalBackdrop"),
  modalClose: document.getElementById("modalClose"),
  modalMeta: document.getElementById("modalMeta"),
  editStatus: document.getElementById("editStatus"),
  editPriority: document.getElementById("editPriority"),
  editFloor: document.getElementById("editFloor"),
  editDescription: document.getElementById("editDescription"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  modalError: document.getElementById("modalError"),
};

let auth = {
  token: localStorage.getItem("tm_token") || null,
  user: JSON.parse(localStorage.getItem("tm_user") || "null"),
};

let ticketTypes = [];
let editingTicketId = null;

function setError(el, msg) {
  if (!msg) { el.style.display = "none"; el.textContent = ""; return; }
  el.style.display = "block";
  el.textContent = msg;
}

function authHeaders() {
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

function fillFloors(selectEl) {
  selectEl.innerHTML = "";
  for (let f = -3; f <= 6; f++) {
    const opt = document.createElement("option");
    opt.value = String(f);
    opt.textContent = String(f);
    selectEl.appendChild(opt);
  }
  selectEl.value = "0";
}

function showApp() {
  els.loginCard.style.display = "none";
  els.app.style.display = "block";
  els.logoutBtn.style.display = "inline-block";
  els.whoami.textContent = auth.user ? `${auth.user.username} (${auth.user.role})` : "";
}

function showLogin() {
  els.loginCard.style.display = "block";
  els.app.style.display = "none";
  els.logoutBtn.style.display = "none";
  els.whoami.textContent = "";
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function login() {
  setError(els.loginError, null);

  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: els.username.value.trim(),
        password: els.password.value,
      }),
    });

    auth.token = data.token;
    auth.user = data.user;
    localStorage.setItem("tm_token", auth.token);
    localStorage.setItem("tm_user", JSON.stringify(auth.user));

    await bootAuthed();
  } catch (e) {
    setError(els.loginError, e.message);
  }
}

function logout() {
  auth = { token: null, user: null };
  localStorage.removeItem("tm_token");
  localStorage.removeItem("tm_user");
  showLogin();
}

async function loadTicketTypes() {
  ticketTypes = await apiFetch("/api/ticket-types");
  els.typeSelect.innerHTML = "";
  for (const tt of ticketTypes) {
    const opt = document.createElement("option");
    opt.value = String(tt.id);
    opt.textContent = `${tt.name} → ${tt.default_assignee_role}`;
    els.typeSelect.appendChild(opt);
  }
}

function pill(text, cls = "") {
  const span = document.createElement("span");
  span.className = `pill ${cls}`.trim();
  span.textContent = text;
  return span;
}

function statusClass(status) {
  if (status === "CLOSED") return "ok";
  if (status === "IN_PROGRESS") return "";
  return "danger";
}

async function loadTickets() {
  const rows = await apiFetch("/api/tickets");
  els.tickets.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No tickets yet.";
    els.tickets.appendChild(empty);
    return;
  }

  for (const t of rows) {
    const card = document.createElement("div");
    card.className = "ticket";

    const top = document.createElement("div");
    top.className = "ticketTop";

    const left = document.createElement("div");
    left.innerHTML = `<div class="ticketTitle">${escapeHtml(t.title)}</div><div class="muted small">${escapeHtml(t.type_name)}</div>`;

    const right = document.createElement("div");
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => openEditModal(t);
    right.appendChild(editBtn);

    top.appendChild(left);
    top.appendChild(right);

    const pills = document.createElement("div");
    pills.className = "pillRow";
    pills.appendChild(pill(`Status: ${t.status}`, statusClass(t.status)));
    pills.appendChild(pill(`Priority: ${t.priority}`));
    pills.appendChild(pill(`Floor: ${t.floor}`));
    pills.appendChild(pill(`Assigned: ${t.assigned_role}`));
    pills.appendChild(pill(`Created by: ${t.created_by}`));

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.textContent = t.description;

    card.appendChild(top);
    card.appendChild(pills);
    card.appendChild(desc);

    els.tickets.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createTicket() {
  setError(els.createError, null);

  try {
    const payload = {
      title: els.title.value.trim(),
      description: els.description.value.trim(),
      type_id: Number(els.typeSelect.value),
      priority: els.priority.value,
      floor: Number(els.floor.value),
    };

    await apiFetch("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    els.title.value = "";
    els.description.value = "";
    els.priority.value = "MEDIUM";
    els.floor.value = "0";

    await loadTickets();
  } catch (e) {
    setError(els.createError, e.message);
  }
}

function openEditModal(t) {
  editingTicketId = t.id;
  setError(els.modalError, null);

  els.modalMeta.textContent =
    `#${t.id} • ${t.type_name} • assigned to ${t.assigned_role} • created by ${t.created_by} • created ${t.created_at}`;

  els.editStatus.value = t.status;
  els.editPriority.value = t.priority;
  els.editFloor.value = String(t.floor);
  els.editDescription.value = t.description;

  // Only admin sees delete
  els.deleteBtn.style.display = auth.user?.role === "admin" ? "inline-block" : "none";

  els.backdrop.style.display = "grid";
}

function closeModal() {
  els.backdrop.style.display = "none";
  editingTicketId = null;
}

async function saveEdit() {
  if (!editingTicketId) return;

  setError(els.modalError, null);

  try {
    await apiFetch(`/api/tickets/${editingTicketId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: els.editStatus.value,
        priority: els.editPriority.value,
        floor: Number(els.editFloor.value),
        description: els.editDescription.value,
      }),
    });

    closeModal();
    await loadTickets();
  } catch (e) {
    setError(els.modalError, e.message);
  }
}

async function deleteTicket() {
  if (!editingTicketId) return;
  if (auth.user?.role !== "admin") return;

  const ok = confirm("Delete this ticket? This cannot be undone.");
  if (!ok) return;

  setError(els.modalError, null);
  try {
    await apiFetch(`/api/tickets/${editingTicketId}`, { method: "DELETE" });
    closeModal();
    await loadTickets();
  } catch (e) {
    setError(els.modalError, e.message);
  }
}

async function bootAuthed() {
  showApp();

  fillFloors(els.floor);
  fillFloors(els.editFloor);

  await loadTicketTypes();
  await loadTickets();
}

// Wire up events
els.loginBtn.addEventListener("click", login);
els.logoutBtn.addEventListener("click", logout);
els.createBtn.addEventListener("click", createTicket);
els.refreshBtn.addEventListener("click", loadTickets);

els.modalClose.addEventListener("click", closeModal);
els.backdrop.addEventListener("click", (e) => { if (e.target === els.backdrop) closeModal(); });
els.saveBtn.addEventListener("click", saveEdit);
els.deleteBtn.addEventListener("click", deleteTicket);

// Auto boot if token exists
(async function init() {
  if (!window.API_BASE_URL) {
    alert("Missing API_BASE_URL. Check frontend/config.js");
    return;
  }

  if (auth.token && auth.user) {
    try {
      await bootAuthed();
    } catch (e) {
      // token likely expired
      logout();
    }
  } else {
    showLogin();
  }
})();
