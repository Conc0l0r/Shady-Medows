/* ══════════════════════════════════════════════════════════════
   admin.js  —  Shady Meadows B&B Admin Panel
══════════════════════════════════════════════════════════════ */

const API = '../api/admin.php';

// ── Bootstrap modal instances ──────────────────────────────────
let bookingModal, replyModal, statusModal;

// ── State ──────────────────────────────────────────────────────
let allBookings = [];
let allMessages = [];
let pendingStatusBookingId = null;
let pendingStatusAction    = null;
let pendingReplyMsgId      = null;

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
  replyModal   = new bootstrap.Modal(document.getElementById('replyModal'));
  statusModal  = new bootstrap.Modal(document.getElementById('statusModal'));

  checkAdminSession();

  // Login
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('adminPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('togglePw').addEventListener('click', () => {
    const inp = document.getElementById('adminPassword');
    const ico = document.getElementById('togglePw').querySelector('i');
    if (inp.type === 'password') { inp.type = 'text';     ico.className = 'bi bi-eye-slash'; }
    else                         { inp.type = 'password'; ico.className = 'bi bi-eye'; }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  // Sidebar tabs
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.querySelector('.admin-sidebar').classList.toggle('open');
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', refreshCurrentTab);

  // Booking filter / search
  document.getElementById('bookingFilter').addEventListener('change', renderBookings);
  document.getElementById('bookingSearch').addEventListener('input', renderBookings);

  // Status modal confirm
  document.getElementById('confirmStatusBtn').addEventListener('click', submitStatus);

  // Reply modal send
  document.getElementById('sendReplyBtn').addEventListener('click', submitReply);
});

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
async function checkAdminSession() {
  try {
    const res = await fetch(`${API}?action=me`);
    const data = await res.json();
    if (data.ok) showAdminApp(data.email);
  } catch (_) { /* not logged in */ }
}

async function doLogin() {
  const pw  = document.getElementById('adminPassword').value.trim();
  const err = document.getElementById('loginError');
  err.classList.add('d-none');

  if (!pw) { showLoginErr('Please enter the admin password.'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in…';

  try {
    const res  = await fetch(`${API}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    if (data.ok) {
      showAdminApp(ADMIN_EMAIL_PLACEHOLDER);
      loadBookings();
    } else {
      showLoginErr(data.error || 'Login failed.');
    }
  } catch (_) {
    showLoginErr('Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-shield-lock me-2"></i>Sign In';
  }
}

function showLoginErr(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('d-none');
}

async function doLogout() {
  await fetch(`${API}?action=logout`, { method: 'POST' });
  document.getElementById('adminApp').classList.add('d-none');
  document.getElementById('loginScreen').classList.remove('d-none');
  document.getElementById('adminPassword').value = '';
}

function showAdminApp(email) {
  document.getElementById('loginScreen').classList.add('d-none');
  document.getElementById('adminApp').classList.remove('d-none');
  document.getElementById('adminEmailDisplay').textContent = email || '';
  loadBookings();
}

// ── Placeholder so we don't expose it in HTML ──────────────────
const ADMIN_EMAIL_PLACEHOLDER = 'shadymedows@gmail.com';

// ══════════════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(b => b.classList.remove('active'));
  document.querySelector(`.sidebar-link[data-tab="${tab}"]`).classList.add('active');

  document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('d-none'));
  document.getElementById(`tab${capitalize(tab)}`).classList.remove('d-none');

  document.getElementById('pageTitle').textContent = capitalize(tab);

  if (tab === 'bookings') loadBookings();
  if (tab === 'messages') loadMessages();
}

function refreshCurrentTab() {
  const active = document.querySelector('.sidebar-link.active[data-tab]');
  if (active) switchTab(active.dataset.tab);
}

// ══════════════════════════════════════════════════════════════
//  BOOKINGS
// ══════════════════════════════════════════════════════════════
async function loadBookings() {
  setBookingLoading(true);
  try {
    const res  = await fetch(`${API}?action=bookings`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    allBookings = data.bookings;
    updateBookingStats();
    renderBookings();
  } catch (e) {
    setBookingLoading(false);
    document.getElementById('bookingsEmpty').classList.remove('d-none');
    document.getElementById('bookingsEmpty').querySelector('p').textContent = 'Error loading bookings: ' + e.message;
  }
}

function setBookingLoading(loading) {
  document.getElementById('bookingsLoading').style.display    = loading ? '' : 'none';
  document.getElementById('bookingsEmpty').classList.add('d-none');
  document.getElementById('bookingsTableWrap').classList.add('d-none');
}

function updateBookingStats() {
  const pending   = allBookings.filter(b => b.status === 'pending').length;
  const confirmed = allBookings.filter(b => b.status === 'confirmed').length;
  const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
  const revenue   = allBookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => sum + parseFloat(b.total), 0);

  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statConfirmed').textContent = confirmed;
  document.getElementById('statCancelled').textContent = cancelled;
  document.getElementById('statRevenue').textContent   = '$' + revenue.toFixed(2);

  // Sidebar badge
  const badge = document.getElementById('pendingCount');
  badge.textContent = pending > 0 ? pending : '';
}

function renderBookings() {
  const filter = document.getElementById('bookingFilter').value;
  const search = document.getElementById('bookingSearch').value.toLowerCase();

  let list = allBookings;
  if (filter !== 'all') list = list.filter(b => b.status === filter);
  if (search) list = list.filter(b =>
    (b.firstname + ' ' + b.lastname).toLowerCase().includes(search) ||
    b.email.toLowerCase().includes(search) ||
    b.reference.toLowerCase().includes(search)
  );

  document.getElementById('bookingsLoading').style.display = 'none';

  if (list.length === 0) {
    document.getElementById('bookingsEmpty').classList.remove('d-none');
    document.getElementById('bookingsEmpty').querySelector('p').textContent = 'No bookings match your filter.';
    document.getElementById('bookingsTableWrap').classList.add('d-none');
    return;
  }

  document.getElementById('bookingsEmpty').classList.add('d-none');
  document.getElementById('bookingsTableWrap').classList.remove('d-none');

  const tbody = document.getElementById('bookingsBody');
  tbody.innerHTML = list.map(b => {
    const statusCls = `status-${b.status}`;
    const canAct    = b.status === 'pending';
    return `
      <tr>
        <td><code style="font-size:.82rem;">${escHtml(b.reference)}</code></td>
        <td>
          <div style="font-weight:600;">${escHtml(b.firstname)} ${escHtml(b.lastname)}</div>
          <div style="font-size:.78rem;color:var(--tm);">${escHtml(b.email)}</div>
        </td>
        <td>${escHtml(b.room_name)}</td>
        <td>${b.checkin}</td>
        <td>${b.checkout}</td>
        <td>${b.guests}</td>
        <td style="font-weight:700;">$${parseFloat(b.total).toFixed(2)}</td>
        <td><span class="status-badge ${statusCls}">${b.status}</span></td>
        <td>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;">
            <button class="btn-action btn-action-view" onclick="openBookingDetail(${b.id})">
              <i class="bi bi-eye"></i> View
            </button>
            ${canAct ? `
            <button class="btn-action btn-action-accept" onclick="openStatusModal(${b.id},'confirmed')">
              <i class="bi bi-check2"></i> Accept
            </button>
            <button class="btn-action btn-action-reject" onclick="openStatusModal(${b.id},'cancelled')">
              <i class="bi bi-x"></i> Reject
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openBookingDetail(id) {
  const b = allBookings.find(x => x.id == id);
  if (!b) return;

  const nights = Math.round((new Date(b.checkout) - new Date(b.checkin)) / 86400000);
  const sub    = parseFloat(b.total) / 1.1;
  const tax    = parseFloat(b.total) - sub;

  document.getElementById('bookingModalBody').innerHTML = `
    <div class="booking-detail-grid">
      <div class="detail-section">
        <h6><i class="bi bi-person"></i> Guest</h6>
        <div class="detail-row"><span class="label">Name</span><span class="val">${escHtml(b.firstname)} ${escHtml(b.lastname)}</span></div>
        <div class="detail-row"><span class="label">Email</span><span class="val">${escHtml(b.email)}</span></div>
        <div class="detail-row"><span class="label">Phone</span><span class="val">${escHtml(b.phone)}</span></div>
        <div class="detail-row"><span class="label">Booked by</span><span class="val">${escHtml(b.username)} (${escHtml(b.user_email)})</span></div>
      </div>
      <div class="detail-section">
        <h6><i class="bi bi-calendar-range"></i> Stay</h6>
        <div class="detail-row"><span class="label">Room</span><span class="val">${escHtml(b.room_name)}</span></div>
        <div class="detail-row"><span class="label">Check-in</span><span class="val">${b.checkin}</span></div>
        <div class="detail-row"><span class="label">Check-out</span><span class="val">${b.checkout}</span></div>
        <div class="detail-row"><span class="label">Nights</span><span class="val">${nights}</span></div>
        <div class="detail-row"><span class="label">Guests</span><span class="val">${b.guests}</span></div>
      </div>
      <div class="detail-section">
        <h6><i class="bi bi-receipt"></i> Charges</h6>
        <div class="detail-row"><span class="label">Subtotal</span><span class="val">$${sub.toFixed(2)}</span></div>
        <div class="detail-row"><span class="label">Tax (10%)</span><span class="val">$${tax.toFixed(2)}</span></div>
        <div class="detail-row"><span class="label">Total</span><span class="val" style="color:var(--gd);font-size:1rem;">$${parseFloat(b.total).toFixed(2)}</span></div>
      </div>
      <div class="detail-section">
        <h6><i class="bi bi-info-circle"></i> Status</h6>
        <div class="detail-row"><span class="label">Reference</span><span class="val"><code>${escHtml(b.reference)}</code></span></div>
        <div class="detail-row"><span class="label">Status</span><span class="val"><span class="status-badge status-${b.status}">${b.status}</span></span></div>
        <div class="detail-row"><span class="label">Booked on</span><span class="val">${new Date(b.created_at).toLocaleDateString()}</span></div>
        ${b.admin_note ? `<div class="detail-row"><span class="label">Admin note</span><span class="val" style="white-space:normal;">${escHtml(b.admin_note)}</span></div>` : ''}
      </div>
    </div>
    ${b.requests ? `<div class="mt-3 p-3" style="background:var(--gold-l);border-radius:8px;font-size:.88rem;"><strong>Special requests:</strong> ${escHtml(b.requests)}</div>` : ''}
  `;

  const footer = document.getElementById('bookingModalFooter');
  footer.innerHTML = b.status === 'pending'
    ? `<button class="btn btn-success btn-sm" onclick="openStatusModal(${b.id},'confirmed');bookingModal.hide()">
         <i class="bi bi-check2 me-1"></i>Accept
       </button>
       <button class="btn btn-danger btn-sm" onclick="openStatusModal(${b.id},'cancelled');bookingModal.hide()">
         <i class="bi bi-x me-1"></i>Reject
       </button>`
    : `<button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>`;

  bookingModal.show();
}

function openStatusModal(bookingId, action) {
  pendingStatusBookingId = bookingId;
  pendingStatusAction    = action;
  document.getElementById('statusNote').value = '';

  const isConfirm = action === 'confirmed';
  document.getElementById('statusModalTitle').textContent  = isConfirm ? 'Confirm Booking' : 'Reject Booking';
  document.getElementById('statusModalDesc').textContent   =
    isConfirm
      ? 'The guest will receive a confirmation email. Optionally add a note.'
      : 'The guest will receive a cancellation email. Optionally add a reason.';
  const btn = document.getElementById('confirmStatusBtn');
  btn.textContent = isConfirm ? 'Confirm' : 'Reject';
  btn.className   = `btn btn-sm ${isConfirm ? 'btn-success' : 'btn-danger'}`;

  statusModal.show();
}

async function submitStatus() {
  const note = document.getElementById('statusNote').value.trim();
  const btn  = document.getElementById('confirmStatusBtn');
  btn.disabled = true;

  try {
    const res  = await fetch(`${API}?action=booking-status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: pendingStatusBookingId, status: pendingStatusAction, note }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    statusModal.hide();
    showToast(data.message, 'success');
    loadBookings();
  } catch (e) {
    showToast('Error: ' + e.message, 'danger');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════════════════════════
async function loadMessages() {
  document.getElementById('messagesLoading').style.display = '';
  document.getElementById('messagesEmpty').classList.add('d-none');
  document.getElementById('messagesList').classList.add('d-none');

  try {
    const res  = await fetch(`${API}?action=messages`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    allMessages = data.messages;
    renderMessages();
  } catch (e) {
    document.getElementById('messagesLoading').style.display = 'none';
    document.getElementById('messagesEmpty').classList.remove('d-none');
    document.getElementById('messagesEmpty').querySelector('p').textContent = 'Error: ' + e.message;
  }
}

function renderMessages() {
  document.getElementById('messagesLoading').style.display = 'none';
  const unreplied = allMessages.filter(m => !m.admin_reply).length;
  const badge = document.getElementById('unreadCount');
  badge.textContent = unreplied > 0 ? unreplied : '';

  if (allMessages.length === 0) {
    document.getElementById('messagesEmpty').classList.remove('d-none');
    return;
  }

  const list = document.getElementById('messagesList');
  list.classList.remove('d-none');
  list.innerHTML = allMessages.map(m => {
    const replyBlock = m.admin_reply
      ? `<div class="msg-reply-block">
           <div class="reply-label"><i class="bi bi-reply me-1"></i>Admin reply · ${new Date(m.replied_at).toLocaleString()}</div>
           <div style="font-size:.87rem;white-space:pre-wrap;">${escHtml(m.admin_reply)}</div>
         </div>`
      : '';
    return `
      <div class="msg-card">
        <div class="msg-card-header">
          <div class="msg-card-from">
            <i class="bi bi-person-circle"></i>
            <div>
              <strong>${escHtml(m.name)}</strong>
              <span style="font-size:.78rem;opacity:.8;margin-left:.5rem;">${escHtml(m.email)}</span>
            </div>
          </div>
          <div class="msg-card-meta">
            ${m.phone ? `<span><i class="bi bi-telephone me-1"></i>${escHtml(m.phone)}</span>` : ''}
            <span><i class="bi bi-clock me-1"></i>${new Date(m.created_at).toLocaleString()}</span>
            ${m.admin_reply
              ? `<span style="background:#d4edda;color:#155724;border-radius:2rem;padding:.1rem .5rem;font-size:.72rem;font-weight:700;">Replied</span>`
              : `<span style="background:#fff3cd;color:#856404;border-radius:2rem;padding:.1rem .5rem;font-size:.72rem;font-weight:700;">Pending Reply</span>`
            }
          </div>
        </div>
        <div class="msg-card-body">
          <div class="msg-subject">${escHtml(m.subject)}</div>
          <div class="msg-text">${escHtml(m.body)}</div>
          ${replyBlock}
        </div>
        <div class="msg-card-footer">
          <button class="btn-action btn-action-view" onclick="openReplyModal(${m.id})">
            <i class="bi bi-reply"></i> ${m.admin_reply ? 'Reply Again' : 'Reply'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function openReplyModal(msgId) {
  pendingReplyMsgId = msgId;
  const msg = allMessages.find(m => m.id == msgId);
  document.getElementById('replyTo').innerHTML =
    `Replying to <strong>${escHtml(msg.name)}</strong> &lt;${escHtml(msg.email)}&gt; regarding: <em>${escHtml(msg.subject)}</em>`;
  document.getElementById('replyText').value = '';
  document.getElementById('replyError').classList.add('d-none');
  replyModal.show();
}

async function submitReply() {
  const reply = document.getElementById('replyText').value.trim();
  const errEl = document.getElementById('replyError');
  errEl.classList.add('d-none');

  if (!reply) { errEl.textContent = 'Reply cannot be empty.'; errEl.classList.remove('d-none'); return; }

  const btn = document.getElementById('sendReplyBtn');
  btn.disabled = true;

  try {
    const res  = await fetch(`${API}?action=reply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: pendingReplyMsgId, reply }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    replyModal.hide();
    showToast(data.message, 'success');
    loadMessages();
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(msg, type = 'success') {
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
    background:${type === 'success' ? 'var(--gd)' : '#c0392b'};
    color:#fff;padding:.75rem 1.2rem;border-radius:8px;
    font-size:.88rem;font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,.2);
    display:flex;align-items:center;gap:.5rem;
    animation:fadeInUp .2s ease;`;
  wrap.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${escHtml(msg)}`;
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4000);
}