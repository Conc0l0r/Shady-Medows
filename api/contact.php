<?php
header('Access-Control-Allow-Origin: https://shadymedows.xo.je');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
// ============================================================
//  api/contact.php
//  POST /api/contact.php  { name, email, phone, subject, body }
//  Public – no auth required
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Method not allowed.', 405);

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$name    = trim($body['name']    ?? '');
$email   = trim($body['email']   ?? '');
$phone   = trim($body['phone']   ?? '');
$subject = trim($body['subject'] ?? '');
$message = trim($body['message'] ?? '');

if (strlen($name)    < 3)  jsonErr('Name must be at least 3 characters.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('Invalid email address.');
if (!preg_match('/^[0-9\s\-\+]{7,15}$/', str_replace([' ','-','+'], '', $phone))) jsonErr('Invalid phone number.');
if (strlen($subject) < 5)  jsonErr('Subject must be at least 5 characters.');
if (strlen($message) < 20) jsonErr('Message must be at least 20 characters.');

$db  = getDB();
$ins = $db->prepare(
    'INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)'
);
$ins->execute([$name, $email, $phone, $subject, $message]);

jsonOk(['message' => 'Your message has been sent.'], 201);
