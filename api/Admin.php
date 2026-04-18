<?php
// ============================================================
//  api/admin.php
//
//  POST /api/admin.php?action=login          { password }
//  POST /api/admin.php?action=logout
//  GET  /api/admin.php?action=me
//
//  GET  /api/admin.php?action=bookings       list all bookings
//  POST /api/admin.php?action=booking-status { id, status, note }
//
//  GET  /api/admin.php?action=messages       list all contact messages
//  POST /api/admin.php?action=reply          { id, reply }
// ============================================================
require_once __DIR__ . '/config.php';
startSession();

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// ── Admin login ───────────────────────────────────────────────
if ($action === 'login' && $method === 'POST') {
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $password = $body['password'] ?? '';

    if (!$password) jsonErr('Password is required.');
    if ($password !== ADMIN_PASSWORD) jsonErr('Invalid admin password.', 401);

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    jsonOk(['message' => 'Admin logged in.']);
}

// ── Admin logout ──────────────────────────────────────────────
if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    jsonOk(['message' => 'Logged out.']);
}

// ── Admin me (session check) ──────────────────────────────────
if ($action === 'me' && $method === 'GET') {
    startSession();
    if (!empty($_SESSION['admin_logged_in'])) {
        jsonOk(['admin' => true, 'email' => ADMIN_EMAIL]);
    }
    jsonErr('Not authenticated.', 401);
}

// All endpoints below require admin session
requireAdmin();

function ensureMessageSchema(PDO $db): void {
    static $checked = false;
    if ($checked) {
        return;
    }

    $stmt = $db->query("SHOW COLUMNS FROM messages");
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    if (!in_array('admin_reply', $columns, true)) {
        $db->exec("ALTER TABLE messages ADD COLUMN admin_reply TEXT DEFAULT NULL");
    }
    if (!in_array('replied_at', $columns, true)) {
        $db->exec("ALTER TABLE messages ADD COLUMN replied_at DATETIME DEFAULT NULL");
    }

    $checked = true;
}

// ── List all bookings ─────────────────────────────────────────
if ($action === 'bookings' && $method === 'GET') {
    $db   = getDB();
    $stmt = $db->query(
        "SELECT b.id, b.reference, b.firstname, b.lastname, b.email, b.phone,
                b.checkin, b.checkout, b.guests, b.requests,
                b.total, b.status, b.admin_note, b.created_at,
                r.name AS room_name, r.price AS room_price,
                u.username, u.email AS user_email
         FROM bookings b
         JOIN rooms r ON b.room_id = r.id
         JOIN users u ON b.user_id = u.id
         ORDER BY b.created_at DESC"
    );
    jsonOk(['bookings' => $stmt->fetchAll()]);
}

// ── Accept / Reject booking ───────────────────────────────────
if ($action === 'booking-status' && $method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $id     = (int)($body['id']     ?? 0);
    $status = trim($body['status']  ?? '');
    $note   = trim($body['note']    ?? '');

    if (!$id) jsonErr('Booking ID is required.');
    if (!in_array($status, ['confirmed', 'cancelled'], true)) jsonErr('Status must be confirmed or cancelled.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $booking = $stmt->fetch();
    if (!$booking) jsonErr('Booking not found.', 404);

    $db->prepare('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?')
       ->execute([$status, $note ?: null, $id]);

    // Notify the guest by email
    $label    = $status === 'confirmed' ? 'Confirmed' : 'Cancelled';
    $color    = $status === 'confirmed' ? '#2d4a3e' : '#c0392b';
    $noteHtml = $note ? "<p><strong>Note from the hotel:</strong> {$note}</p>" : '';
    $html = "
        <div style='font-family:Lato,sans-serif;max-width:520px;margin:auto;padding:2rem;'>
          <h2 style='color:{$color};font-family:Georgia,serif;'>Booking {$label}</h2>
          <p>Dear <strong>{$booking['firstname']} {$booking['lastname']}</strong>,</p>
          <p>Your booking <strong>{$booking['reference']}</strong> has been <strong>{$label}</strong>.</p>
          <table style='width:100%;border-collapse:collapse;margin:1rem 0;'>
            <tr><td style='padding:.4rem;color:#666;'>Room</td><td style='padding:.4rem;font-weight:600;'>{$booking['room_id']}</td></tr>
            <tr style='background:#f9f9f9;'><td style='padding:.4rem;color:#666;'>Check-in</td><td style='padding:.4rem;'>{$booking['checkin']}</td></tr>
            <tr><td style='padding:.4rem;color:#666;'>Check-out</td><td style='padding:.4rem;'>{$booking['checkout']}</td></tr>
            <tr style='background:#f9f9f9;'><td style='padding:.4rem;color:#666;'>Total</td><td style='padding:.4rem;font-weight:600;'>$" . number_format($booking['total'], 2) . "</td></tr>
          </table>
          {$noteHtml}
          <p style='color:#888;font-size:.85rem;'>Thank you for choosing Shady Meadows B&amp;B.</p>
        </div>";

    sendMail($booking['email'], $booking['firstname'] . ' ' . $booking['lastname'],
             "Shady Meadows — Booking {$label}: {$booking['reference']}", $html);

    jsonOk(['message' => "Booking {$status}. Guest notified by email."]);
}

// ── List all contact messages ─────────────────────────────────
if ($action === 'messages' && $method === 'GET') {
    $db = getDB();
    ensureMessageSchema($db);
    $stmt = $db->query(
        'SELECT id, name, email, phone, subject, body, admin_reply, replied_at, created_at
         FROM messages ORDER BY created_at DESC'
    );
    jsonOk(['messages' => $stmt->fetchAll()]);
}

// ── Reply to a contact message ────────────────────────────────
if ($action === 'reply' && $method === 'POST') {
    $db = getDB();
    ensureMessageSchema($db);
    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $id    = (int)($body['id']    ?? 0);
    $reply = trim($body['reply']  ?? '');

    if (!$id)    jsonErr('Message ID is required.');
    if (!$reply) jsonErr('Reply text is required.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM messages WHERE id = ?');
    $stmt->execute([$id]);
    $msg = $stmt->fetch();
    if (!$msg) jsonErr('Message not found.', 404);

    $db->prepare('UPDATE messages SET admin_reply = ?, replied_at = NOW() WHERE id = ?')
       ->execute([$reply, $id]);

    // Send reply email to the person who contacted
    $html = "
        <div style='font-family:Lato,sans-serif;max-width:520px;margin:auto;padding:2rem;'>
          <h2 style='color:#2d4a3e;font-family:Georgia,serif;'>Reply from Shady Meadows B&amp;B</h2>
          <p>Dear <strong>{$msg['name']}</strong>,</p>
          <p>Thank you for reaching out. Here is our reply to your enquiry regarding: <em>{$msg['subject']}</em></p>
          <blockquote style='border-left:4px solid #c8a96e;margin:1rem 0;padding:.75rem 1.2rem;background:#f5ecd8;border-radius:0 8px 8px 0;color:#1a2820;'>
            " . nl2br(htmlspecialchars($reply)) . "
          </blockquote>
          <p>If you have further questions, feel free to contact us again.</p>
          <p style='color:#888;font-size:.85rem;'>Warm regards,<br>Shady Meadows B&amp;B Team</p>
        </div>";

    sendMail($msg['email'], $msg['name'], 'Re: ' . $msg['subject'], $html);

    jsonOk(['message' => 'Reply sent to ' . $msg['email']]);
}

jsonErr('Unknown action.', 400);