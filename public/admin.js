const ADMIN_SESSION_KEY = "pb-admin-session";
const PAGE_SIZE = 10;

/* ── detail drawer ── */
function openDrawer(title, bodyHtml) {
  document.getElementById("detailDrawerTitle").textContent = title;
  document.getElementById("detailDrawerBody").innerHTML = bodyHtml;
  document.getElementById("detailDrawer").classList.add("is-open");
  document.getElementById("detailBackdrop").classList.add("is-open");
}

function closeDrawer() {
  document.getElementById("detailDrawer").classList.remove("is-open");
  document.getElementById("detailBackdrop").classList.remove("is-open");
}

document.getElementById("detailDrawerClose").addEventListener("click", closeDrawer);
document.getElementById("detailBackdrop").addEventListener("click", closeDrawer);

const state = {
  authed: false,
  data: null,
  section: "dashboard",
  userPage: 1,
  userSearch: "",
  projectPage: 1,
  projectSearch: "",
  roomPage: 1,
  roomSearch: "",
};

/* ── helpers ── */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDate(v) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(v));
}

let noticeTimer = null;
function showNotice(msg, type = "success") {
  const el = document.getElementById("adminNotice");
  el.textContent = msg;
  el.className = `admin-notice is-visible ${type}`;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove("is-visible"), 3000);
}

/* ── confirm dialog ── */
let confirmResolve = null;
function confirm(title, message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    document.getElementById("confirmOverlay").classList.add("is-open");
  });
}

document.getElementById("confirmCancelBtn").addEventListener("click", () => {
  document.getElementById("confirmOverlay").classList.remove("is-open");
  if (confirmResolve) confirmResolve(false);
});
document.getElementById("confirmOkBtn").addEventListener("click", () => {
  document.getElementById("confirmOverlay").classList.remove("is-open");
  if (confirmResolve) confirmResolve(true);
});

/* ── api ── */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : {};
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── auth ── */
function checkStoredSession() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  } catch { return false; }
}

function storeSession() {
  try { sessionStorage.setItem(ADMIN_SESSION_KEY, "1"); } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch {}
}

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwd = document.getElementById("adminPasswordInput").value.trim();
  const notice = document.getElementById("loginNotice");
  notice.className = "login-notice";
  notice.textContent = "";

  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pwd }) });
    storeSession();
    enterAdmin();
  } catch (err) {
    notice.className = "login-notice error";
    notice.textContent = err.message || "Invalid password.";
  }
});

document.getElementById("adminLogoutBtn").addEventListener("click", () => {
  clearSession();
  location.reload();
});

/* ── load data ── */
async function loadData() {
  state.data = await api("/api/admin/data");
}

/* ── navigation ── */
document.querySelectorAll(".nav-item[data-section]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sec = btn.dataset.section;
    state.section = sec;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.querySelectorAll(".admin-section").forEach((s) => s.classList.remove("is-active"));
    document.getElementById(`section-${sec}`)?.classList.add("is-active");
    renderSection(sec);
  });
});

/* ── render ── */
function renderSection(sec) {
  if (sec === "dashboard") renderDashboard();
  if (sec === "users") renderUsers();
  if (sec === "projects") renderProjects();
  if (sec === "rooms") renderRooms();
  if (sec === "requests") renderRequests();
}

function renderDashboard() {
  const d = state.data;
  const totalMessages = d.conversations.reduce((n, c) => n + (c.messages?.length || 0), 0);
  const closedRooms = d.conversations.filter((c) => c.closed).length;
  const pendingConn = (d.connectionRequests || []).filter((r) => r.status === "pending").length;
  const pendingProj = (d.projectRequests || []).filter((r) => r.status === "pending").length;

  document.getElementById("dashStats").innerHTML = [
    { label: "Total users", value: d.users.length },
    { label: "Total projects", value: d.projects.length },
    { label: "Focus rooms", value: d.conversations.length },
    { label: "Messages sent", value: totalMessages },
    { label: "Closed rooms", value: closedRooms },
    { label: "Pending connection requests", value: pendingConn },
    { label: "Pending project requests", value: pendingProj },
    { label: "Total notifications", value: (d.notifications || []).length },
  ].map((s) => `
    <div class="stat-card">
      <p class="stat-label">${esc(s.label)}</p>
      <p class="stat-value">${s.value}</p>
    </div>
  `).join("");

  // Recent activity: last 10 notifications sorted by date
  const notifs = [...(d.notifications || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  const tbody = document.getElementById("recentActivity");
  if (!notifs.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No activity yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = notifs.map((n) => `
    <tr>
      <td><span class="badge badge-blue">${esc(n.type?.replace(/_/g, " "))}</span></td>
      <td class="td-soft" style="white-space:normal;max-width:360px;">${esc(n.message)}</td>
      <td class="td-soft">${fmtDate(n.createdAt)}</td>
    </tr>
  `).join("");
}

function paginate(items, page) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function renderPagination(containerId, total, page, onChange) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById(containerId);
  if (pages <= 1) { el.innerHTML = ""; return; }
  const items = [];
  items.push(`<button class="page-btn" data-p="${page - 1}" ${page === 1 ? "disabled" : ""}>← Prev</button>`);
  for (let i = 1; i <= pages; i++) {
    items.push(`<button class="page-btn ${i === page ? "is-active" : ""}" data-p="${i}">${i}</button>`);
  }
  items.push(`<button class="page-btn" data-p="${page + 1}" ${page === pages ? "disabled" : ""}>Next →</button>`);
  el.innerHTML = `<span style="margin-right:auto;color:var(--text-soft);">${total} total</span>${items.join("")}`;
  el.querySelectorAll("[data-p]").forEach((btn) => {
    btn.addEventListener("click", () => onChange(Number(btn.dataset.p)));
  });
}

function getInitials(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]?.toUpperCase() || "").join("");
}

function showUserDetail(userId) {
  const u = state.data.users.find(x => x.id === userId);
  if (!u) return;
  const userMap = Object.fromEntries(state.data.users.map(x => [x.id, x.name]));
  const projMap = Object.fromEntries(state.data.projects.map(p => [p.id, p.title]));

  const ownedProjects = state.data.projects.filter(p => p.ownerId === u.id);
  const rooms = state.data.conversations.filter(c => (c.participantIds || []).includes(u.id));
  const friends = (u.friendIds || []).map(id => userMap[id]).filter(Boolean);

  const html = `
    <div class="detail-section">
      <div class="detail-avatar">${esc(getInitials(u.name))}</div>
      <p class="detail-name">${esc(u.name)}</p>
      <span class="detail-role">${esc(u.role)}</span>
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Profile</p>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-item-label">Specialty</span><span class="detail-item-value">${esc(u.specialty)}</span></div>
        <div class="detail-item"><span class="detail-item-label">City</span><span class="detail-item-value">${esc(u.city)}</span></div>
        <div class="detail-item"><span class="detail-item-label">Status</span><span class="detail-item-value">${esc(u.status)}</span></div>
        <div class="detail-item"><span class="detail-item-label">Availability</span><span class="detail-item-value">${esc(u.availability)}</span></div>
        <div class="detail-item full"><span class="detail-item-label">Bio</span><span class="detail-item-value">${esc(u.bio)}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Stats</p>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-item-label">Projects owned</span><span class="detail-item-value">${ownedProjects.length}</span></div>
        <div class="detail-item"><span class="detail-item-label">Active rooms</span><span class="detail-item-value">${rooms.length}</span></div>
        <div class="detail-item"><span class="detail-item-label">Network size</span><span class="detail-item-value">${friends.length} connections</span></div>
        <div class="detail-item"><span class="detail-item-label">User ID</span><span class="detail-item-value" style="font-size:0.76rem;opacity:0.6;">${esc(u.id)}</span></div>
      </div>
    </div>

    ${(u.interests || []).length ? `
    <div class="detail-section">
      <p class="detail-section-title">Interests</p>
      <div class="detail-pills">
        ${(u.interests || []).map(i => `<span class="detail-pill">${esc(i)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${friends.length ? `
    <div class="detail-section">
      <p class="detail-section-title">Network (${friends.length})</p>
      <div class="detail-pills">
        ${friends.map(name => `<span class="detail-pill">${esc(name)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${ownedProjects.length ? `
    <div class="detail-section">
      <p class="detail-section-title">Owned Projects (${ownedProjects.length})</p>
      <div style="display:grid;gap:8px;">
        ${ownedProjects.map(p => `
          <div class="detail-item" style="cursor:pointer;" data-action="view-project" data-id="${p.id}">
            <span class="detail-item-label">${esc(p.domain)} · ${esc(p.stage)}</span>
            <span class="detail-item-value">${esc(p.title)}</span>
          </div>`).join("")}
      </div>
    </div>` : ""}
  `;
  openDrawer(u.name, html);
}

function showProjectDetail(projectId) {
  const p = state.data.projects.find(x => x.id === projectId);
  if (!p) return;
  const userMap = Object.fromEntries(state.data.users.map(u => [u.id, u.name]));
  const owner = state.data.users.find(u => u.id === p.ownerId);
  const rooms = state.data.conversations.filter(c => c.projectId === p.id);
  const joinReqs = (state.data.projectRequests || []).filter(r => r.projectId === p.id);

  const html = `
    <div class="detail-section">
      <p class="detail-name" style="font-size:1.2rem;">${esc(p.title)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <span class="detail-role">${esc(p.domain)}</span>
        <span class="badge badge-blue">${esc(p.stage)}</span>
      </div>
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Overview</p>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-item-label">Owner</span><span class="detail-item-value">${esc(owner?.name || p.ownerId)}</span></div>
        <div class="detail-item"><span class="detail-item-label">Looking for</span><span class="detail-item-value">${esc(p.lookingFor || "—")}</span></div>
        <div class="detail-item"><span class="detail-item-label">Created</span><span class="detail-item-value">${fmtDate(p.createdAt)}</span></div>
        <div class="detail-item"><span class="detail-item-label">Rooms</span><span class="detail-item-value">${rooms.length}</span></div>
        <div class="detail-item full"><span class="detail-item-label">Summary</span><span class="detail-item-value">${esc(p.summary)}</span></div>
        <div class="detail-item full"><span class="detail-item-label">Collaboration goal</span><span class="detail-item-value">${esc(p.collaborationGoal)}</span></div>
      </div>
    </div>

    ${(p.tags || []).length ? `
    <div class="detail-section">
      <p class="detail-section-title">Tags</p>
      <div class="detail-pills">
        ${(p.tags || []).map(t => `<span class="detail-pill">${esc(t)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${rooms.length ? `
    <div class="detail-section">
      <p class="detail-section-title">Rooms (${rooms.length})</p>
      <div style="display:grid;gap:8px;">
        ${rooms.map(r => `
          <div class="detail-item">
            <span class="detail-item-label">${(r.participantIds||[]).map(id => userMap[id]||id).join(" · ")}</span>
            <span class="detail-item-value">${esc(r.title)} ${r.closed ? '<span class="badge badge-red" style="font-size:0.65rem;">Closed</span>' : '<span class="badge badge-green" style="font-size:0.65rem;">Open</span>'}</span>
          </div>`).join("")}
      </div>
    </div>` : ""}

    ${joinReqs.length ? `
    <div class="detail-section">
      <p class="detail-section-title">Join requests (${joinReqs.length})</p>
      <div style="display:grid;gap:8px;">
        ${joinReqs.map(r => `
          <div class="detail-item">
            <span class="detail-item-label">${esc(userMap[r.fromId]||r.fromId)} · <span class="badge ${r.status==='pending'?'badge-yellow':r.status==='accepted'?'badge-green':'badge-red'}">${esc(r.status)}</span></span>
            ${r.motivation ? `<span class="detail-item-value" style="font-style:italic;">"${esc(r.motivation)}"</span>` : ""}
          </div>`).join("")}
      </div>
    </div>` : ""}
  `;
  openDrawer(p.title, html);
}

function renderUsers() {
  const search = state.userSearch.toLowerCase();
  const all = state.data.users.filter((u) =>
    !search || `${u.name} ${u.role} ${u.city} ${u.specialty}`.toLowerCase().includes(search)
  );
  const page = paginate(all, state.userPage);
  const tbody = document.getElementById("usersTableBody");
  if (!page.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No users found.</td></tr>`;
  } else {
    tbody.innerHTML = page.map((u) => `
      <tr>
        <td class="td-name">${esc(u.name)}</td>
        <td class="td-soft">${esc(u.role)}</td>
        <td class="td-soft">${esc(u.specialty)}</td>
        <td class="td-soft">${esc(u.city)}</td>
        <td><span class="badge badge-gray">${(u.friendIds || []).length}</span></td>
        <td>
          <button class="action-btn" data-action="view-user" data-id="${u.id}">View</button>
          <button class="action-btn danger" data-action="delete-user" data-id="${u.id}">Delete</button>
        </td>
      </tr>
    `).join("");
  }
  renderPagination("usersPagination", all.length, state.userPage, (p) => { state.userPage = p; renderUsers(); });
}

function renderProjects() {
  const search = state.projectSearch.toLowerCase();
  const userMap = Object.fromEntries(state.data.users.map((u) => [u.id, u.name]));
  const all = state.data.projects.filter((p) =>
    !search || `${p.title} ${p.domain} ${p.stage}`.toLowerCase().includes(search)
  );
  const page = paginate(all, state.projectPage);
  const tbody = document.getElementById("projectsTableBody");
  if (!page.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No projects found.</td></tr>`;
  } else {
    tbody.innerHTML = page.map((p) => `
      <tr>
        <td class="td-name" style="max-width:200px;">${esc(p.title)}</td>
        <td class="td-soft">${esc(p.domain)}</td>
        <td><span class="badge badge-blue">${esc(p.stage)}</span></td>
        <td class="td-soft">${esc(userMap[p.ownerId] || p.ownerId)}</td>
        <td class="td-soft">${fmtDate(p.createdAt)}</td>
        <td>
          <button class="action-btn" data-action="view-project" data-id="${p.id}">View</button>
          <button class="action-btn danger" data-action="delete-project" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join("");
  }
  renderPagination("projectsPagination", all.length, state.projectPage, (p) => { state.projectPage = p; renderProjects(); });
}

function renderRooms() {
  const search = state.roomSearch.toLowerCase();
  const userMap = Object.fromEntries(state.data.users.map((u) => [u.id, u.name]));
  const projMap = Object.fromEntries(state.data.projects.map((p) => [p.id, p.title]));
  const all = state.data.conversations.filter((c) =>
    !search || `${c.title} ${c.focus}`.toLowerCase().includes(search)
  );
  const page = paginate(all, state.roomPage);
  const tbody = document.getElementById("roomsTableBody");
  if (!page.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No rooms found.</td></tr>`;
  } else {
    tbody.innerHTML = page.map((c) => {
      const participants = (c.participantIds || []).map((id) => userMap[id] || id).join(", ");
      const status = c.closed
        ? `<span class="badge badge-red">Closed</span>`
        : `<span class="badge badge-green">Open</span>`;
      const closeBtn = c.closed
        ? ""
        : `<button class="action-btn" data-action="close-room" data-id="${c.id}">Close</button>`;
      return `
        <tr>
          <td class="td-name" style="max-width:180px;">${esc(c.title)}</td>
          <td class="td-soft">${esc(projMap[c.projectId] || "—")}</td>
          <td class="td-soft" style="max-width:180px;white-space:normal;">${esc(participants)}</td>
          <td><span class="badge badge-gray">${(c.messages || []).length}</span></td>
          <td>${status}</td>
          <td>${closeBtn}</td>
        </tr>
      `;
    }).join("");
  }
  renderPagination("roomsPagination", all.length, state.roomPage, (p) => { state.roomPage = p; renderRooms(); });
}

function renderRequests() {
  const userMap = Object.fromEntries(state.data.users.map((u) => [u.id, u.name]));
  const projMap = Object.fromEntries(state.data.projects.map((p) => [p.id, p.title]));

  const connReqs = [...(state.data.connectionRequests || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const projReqs = [...(state.data.projectRequests || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const connBody = document.getElementById("connReqBody");
  connBody.innerHTML = connReqs.length
    ? connReqs.map((r) => `
        <tr>
          <td class="td-name">${esc(userMap[r.fromId] || r.fromId)}</td>
          <td class="td-soft">${esc(userMap[r.toId] || r.toId)}</td>
          <td><span class="badge ${r.status === "pending" ? "badge-yellow" : r.status === "accepted" ? "badge-green" : "badge-red"}">${esc(r.status)}</span></td>
          <td class="td-soft">${fmtDate(r.createdAt)}</td>
        </tr>
      `).join("")
    : `<tr class="empty-row"><td colspan="4">No connection requests.</td></tr>`;

  const projBody = document.getElementById("projReqBody");
  projBody.innerHTML = projReqs.length
    ? projReqs.map((r) => `
        <tr>
          <td class="td-name">${esc(userMap[r.fromId] || r.fromId)}</td>
          <td class="td-soft">${esc(projMap[r.projectId] || r.projectId)}</td>
          <td class="td-soft" style="max-width:200px;white-space:normal;">${esc(r.motivation || "—")}</td>
          <td><span class="badge ${r.status === "pending" ? "badge-yellow" : r.status === "accepted" ? "badge-green" : "badge-red"}">${esc(r.status)}</span></td>
          <td class="td-soft">${fmtDate(r.createdAt)}</td>
        </tr>
      `).join("")
    : `<tr class="empty-row"><td colspan="5">No project requests.</td></tr>`;
}

/* ── search bindings ── */
document.getElementById("userSearch").addEventListener("input", (e) => {
  state.userSearch = e.target.value;
  state.userPage = 1;
  renderUsers();
});
document.getElementById("projectSearch").addEventListener("input", (e) => {
  state.projectSearch = e.target.value;
  state.projectPage = 1;
  renderProjects();
});
document.getElementById("roomSearch").addEventListener("input", (e) => {
  state.roomSearch = e.target.value;
  state.roomPage = 1;
  renderRooms();
});

/* ── action delegation ── */
document.getElementById("detailDrawerBody").addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.dataset.action === "view-project") showProjectDetail(el.dataset.id);
  if (el.dataset.action === "view-user") showUserDetail(el.dataset.id);
});

document.querySelector(".admin-main").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === "view-user") { showUserDetail(id); return; }
  if (action === "view-project") { showProjectDetail(id); return; }

  if (action === "delete-user") {
    const ok = await confirm("Delete user", "This will permanently remove the user profile. This cannot be undone.");
    if (!ok) return;
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      await loadData();
      renderUsers();
      showNotice("User deleted.");
    } catch (err) { showNotice(err.message, "error"); }
  }

  if (action === "delete-project") {
    const ok = await confirm("Delete project", "This will permanently remove the project. This cannot be undone.");
    if (!ok) return;
    try {
      await api(`/api/admin/projects/${id}`, { method: "DELETE" });
      await loadData();
      renderProjects();
      showNotice("Project deleted.");
    } catch (err) { showNotice(err.message, "error"); }
  }

  if (action === "close-room") {
    const ok = await confirm("Close room", "The chat history will be preserved but no new messages can be sent.");
    if (!ok) return;
    try {
      await api(`/api/conversations/${id}/close`, { method: "PATCH" });
      await loadData();
      renderRooms();
      showNotice("Room closed.");
    } catch (err) { showNotice(err.message, "error"); }
  }
});

/* ── enter ── */
async function enterAdmin() {
  state.authed = true;
  document.getElementById("adminLogin").style.display = "none";
  document.getElementById("adminShell").classList.add("is-visible");
  try {
    await loadData();
    renderDashboard();
  } catch (err) {
    showNotice("Failed to load data: " + err.message, "error");
  }
}

/* ── init ── */
if (checkStoredSession()) {
  enterAdmin();
}
