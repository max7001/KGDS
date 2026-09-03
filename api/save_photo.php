<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * API: Ricezione, validazione e salvataggio fotografie
 */

require_once __DIR__ . '/../includes/app_functions.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['status' => 'error', 'message' => 'Metodo non consentito. Richiesto POST.'], 405);
}

// Lettura parametri
$pvId = $_POST['pv_id'] ?? null;
$espositoreId = $_POST['espositore_id'] ?? null;
$notes = $_POST['notes'] ?? '';
$imageData = $_POST['image_base64'] ?? null;

// Se inviato come JSON raw nel body
if (!$pvId && !$imageData) {
    $rawInput = file_get_contents('php://input');
    $json = json_decode($rawInput, true);
    if ($json) {
        $pvId = $json['pv_id'] ?? null;
        $espositoreId = $json['espositore_id'] ?? null;
        $notes = $json['notes'] ?? '';
        $imageData = $json['image_base64'] ?? null;
    }
}

if (!$pvId || !$espositoreId) {
    sendJsonResponse(['status' => 'error', 'message' => 'Parametri mancanti: pv_id o espositore_id assente.'], 400);
}

$guid = generateGUID();
$targetFilename = $guid . '.jpeg';
$uploadDir = DIR_UPLOAD;

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$destPath = $uploadDir . DIRECTORY_SEPARATOR . $targetFilename;
$publicPath = 'upload/' . $targetFilename;

$saved = false;

// 1. Caso Base64 (da Canvas / WebRTC)
if ($imageData) {
    if (strpos($imageData, 'base64,') !== false) {
        $parts = explode('base64,', $imageData);
        $rawBase64 = $parts[1];
    } else {
        $rawBase64 = $imageData;
    }
    
    $decoded = base64_decode($rawBase64);
    if ($decoded !== false && strlen($decoded) > 100) {
        if (file_put_contents($destPath, $decoded) !== false) {
            $saved = true;
        }
    }
}
// 2. Caso multipart file upload (standard o fallback input file)
elseif (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    $tmpName = $_FILES['photo']['tmp_name'];
    if (is_uploaded_file($tmpName)) {
        if (move_uploaded_file($tmpName, $destPath)) {
            $saved = true;
        }
    }
}

if (!$saved) {
    sendJsonResponse(['status' => 'error', 'message' => 'Errore durante la scrittura del file immagine.'], 500);
}

// Registra record nel database
$currentUser = getCurrentUser();
$username = $currentUser['username'] ?? 'agente';
$scatto = saveScatto($pvId, (int)$espositoreId, $targetFilename, $publicPath, $username, $notes);

sendJsonResponse([
    'status' => 'success',
    'message' => 'Fotografia salvata con successo!',
    'guid' => $guid,
    'filename' => $targetFilename,
    'filepath' => $publicPath,
    'scatto' => $scatto
]);
