const users = [
  { u: "admin", p: "admin123", r: "admin" },
  { u: "facility", p: "facility123", r: "facility" },
  { u: "cleaner", p: "cleaner123", r: "cleaner" },
  { u: "user", p: "user123", r: "user" }
];

const routing = {
  "Plumbing issue": "facility",
  "Electrical issue": "facility",
  "HVAC / Air conditioning": "facility",
  "Furniture damage": "facility",
  "Cleaning request": "cleaner",
  "Trash / waste issue": "cleaner",
  "Restroom cleaning": "cleaner",
  "Other": "admin"
};

let currentUser = null;
let tickets = JSON.parse(localStorage.getItem("tickets") || "[]");

for (let i = -3; i <= 6; i++) {
  floor.innerHTML += `<option>${i}</option>`;
}

function save() {
  localStorage.setItem("tickets", JSON.stringify(tickets));
}

function login() {
  const u = users.find(
    x => x.u === loginUser.value && x.p === loginPass.value
  );
  if (!u) {
    loginError.textContent = "Invalid login";
    return;
  }
  currentUser = u;
  loginCard.hidden = true;
  app.hidden = false;
  userBar.innerHTML = `${u.u} (${u.r}) <button onclick="logout()">Logout</button>`;
  render();
}

function logout() {
  currentUser = null;
  app.hidden = true;
  loginCard.hidden = false;
}

function createTicket() {
  tickets.unshift({
    id: Date.now(),
    title: title.value,
    desc: description.value,
    type: type.value,
    priority: priority.value,
    floor: floor.value,
    status: "OPEN",
    assigned: routing[type.value],
    createdBy: currentUser.u
  });
  save();
  render();
}

function render() {
  ticketsDiv = tickets.filter(t => {
    if (currentUser.r === "admin") return true;
    if (currentUser.r === "user") return t.createdBy === currentUser.u;
    return t.assigned === currentUser.r;
  });

  ticketsEl = document.getElementById("tickets");
  ticketsEl.innerHTML = "";

  ticketsDiv.forEach(t => {
    ticketsEl.innerHTML += `
      <div class="ticket">
        <b>${t.title}</b>
        <div>
          <span class="badge">${t.type}</span>
          <span class="badge">${t.priority}</span>
          <span class="badge">Floor ${t.floor}</span>
          <span class="badge">${t.status}</span>
        </div>
        <p>${t.desc}</p>
      </div>
    `;
  });
}
