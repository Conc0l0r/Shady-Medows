<?php
header('Access-Control-Allow-Origin: https://shadymedows.xo.je');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
// ============================================================
//  api/auth.php
//  POST /api/auth.php?action=register   { username, email, password }
//  POST /api/auth.php?action=login      { username, password }
//  POST /api/auth.php?action=logout
//  GET  /api/auth.php?action=me
// ============================================================
require_once __DIR__ . '/config.php';
startSession();

$action = $_GET['action'] ?? '';

// -- GET /me  (check current session) -------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
    if (!empty($_SESSION['user_id'])) {
        jsonOk(['user' => [
            'id'       => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'email'    => $_SESSION['email'],
        ]]);
    }
    jsonErr('Not authenticated', 401);
}

// -- POST -----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// -- REGISTER -------------------------------------------------
if ($action === 'register') {
    $username = trim($body['username'] ?? '');
    $email    = trim($body['email']    ?? '');
    $password =      $body['password'] ?? '';

    if (strlen($username) < 3) jsonErr('Username must be at least 3 characters.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('Invalid email address.');
    if (strlen($password) < 8) jsonErr('Password must be at least 8 characters.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) jsonErr('Username or email already taken.', 409);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $ins  = $db->prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    $ins->execute([$username, $email, $hash]);

    $userId = (int) $db->lastInsertId();
    $_SESSION['user_id']  = $userId;
    $_SESSION['username'] = $username;
    $_SESSION['email']    = $email;

    jsonOk(['user' => ['id' => $userId, 'username' => $username, 'email' => $email]], 201);
}

// -- LOGIN ----------------------------------------------------
if ($action === 'login') {
    $username = trim($body['username'] ?? '');
    $password =      $body['password'] ?? '';

    if (!$username || !$password) jsonErr('Username and password are required.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, email, password FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonErr('Invalid username or password.', 401);
    }

    session_regenerate_id(true);
    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email']    = $user['email'];

    // -- Admin redirect if logging in with admin email --------
    if ($user['email'] === 'shadymedows@gmail.com') {
        $_SESSION['admin_logged_in'] = true;
        jsonOk(['user' => [
            'id'       => $user['id'],
            'username' => $user['username'],
            'email'    => $user['email'],
        ], 'redirect' => 'admin/index.html']);
    }

    jsonOk(['user' => [
        'id'       => $user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
    ]]);
}

// -- LOGOUT ---------------------------------------------------
if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    jsonOk(['message' => 'Logged out.']);
}

jsonErr('Unknown action.', 400);