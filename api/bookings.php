<?php
// ============================================================
//  api/bookings.php
//  GET  /api/bookings.php           – list my bookings (auth)
//  POST /api/bookings.php           – create booking    (auth)
//  GET  /api/bookings.php?check=1&room_id=&checkin=&checkout=
//                                   – availability check (public)
// ============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── Availability check (public) ───────────────────────────────
if ($method === 'GET' && isset($_GET['check'])) {
    $roomId   = (int)($_GET['room_id']  ?? 0);
    $checkin  = $_GET['checkin']  ?? '';
    $checkout = $_GET['checkout'] ?? '';

    if (!$roomId || !$checkin || !$checkout) jsonErr('room_id, checkin and checkout are required.');

    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS cnt FROM bookings
         WHERE room_id = ? AND status != 'cancelled'
           AND checkin  < ?
           AND checkout > ?"
    );
    $stmt->execute([$roomId, $checkout, $checkin]);
    $row = $stmt->fetch();

    jsonOk(['available' => $row['cnt'] == 0]);
}

// ── List MY bookings (auth required) ─────────────────────────
if ($method === 'GET') {
    $user = requireAuth();
    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT b.*, r.name AS room_name, r.price AS room_price
         FROM bookings b JOIN rooms r ON b.room_id = r.id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC"
    );
    $stmt->execute([$user['id']]);
    jsonOk(['bookings' => $stmt->fetchAll()]);
}

// ── Create booking (auth required) ───────────────────────────
if ($method === 'POST') {
    $user = requireAuth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Validate fields
    $roomId   = (int)($body['room_id']   ?? 0);
    $checkin  = trim($body['checkin']    ?? '');
    $checkout = trim($body['checkout']   ?? '');
    $guests   = (int)($body['guests']    ?? 1);
    $fname    = trim($body['firstname']  ?? '');
    $lname    = trim($body['lastname']   ?? '');
    $email    = trim($body['email']      ?? '');
    $phone    = trim($body['phone']      ?? '');
    $requests = trim($body['requests']   ?? '');

    if (!$roomId)   jsonErr('Invalid room.');
    if (!$checkin || !$checkout) jsonErr('Dates are required.');
    if (strtotime($checkout) <= strtotime($checkin)) jsonErr('Checkout must be after checkin.');
    if (strtotime($checkin) < strtotime('today')) jsonErr('Checkin cannot be in the past.');
    if (!$fname || !$lname) jsonErr('First and last name are required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('Invalid email.');
    if (!preg_match('/^[0-9\s\-\+]{7,15}$/', $phone)) jsonErr('Invalid phone.');

    $db = getDB();

    // Check room exists
    $r = $db->prepare('SELECT * FROM rooms WHERE id = ?');
    $r->execute([$roomId]);
    $room = $r->fetch();
    if (!$room) jsonErr('Room not found.', 404);

    // Check availability
    $avail = $db->prepare(
        "SELECT COUNT(*) AS cnt FROM bookings
         WHERE room_id = ? AND status != 'cancelled'
           AND checkin < ? AND checkout > ?"
    );
    $avail->execute([$roomId, $checkout, $checkin]);
    if ($avail->fetch()['cnt'] > 0) jsonErr('Room not available for selected dates.', 409);

    // Calculate total
    $nights = (int) round((strtotime($checkout) - strtotime($checkin)) / 86400);
    $sub    = $room['price'] * $nights;
    $tax    = round($sub * 0.10, 2);
    $total  = $sub + $tax;

    // Unique reference
    $ref = 'SMB-' . strtoupper(substr(md5(uniqid('', true)), 0, 6));

    $ins = $db->prepare(
        "INSERT INTO bookings
           (user_id, room_id, checkin, checkout, guests,
            firstname, lastname, email, phone, requests, total, reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $ins->execute([
        $user['id'], $roomId, $checkin, $checkout, $guests,
        $fname, $lname, $email, $phone, $requests, $total, $ref
    ]);

    jsonOk([
        'booking' => [
            'id'        => (int) $db->lastInsertId(),
            'reference' => $ref,
            'room'      => $room['name'],
            'checkin'   => $checkin,
            'checkout'  => $checkout,
            'nights'    => $nights,
            'total'     => $total,
        ]
    ], 201);
}

jsonErr('Method not allowed.', 405);
