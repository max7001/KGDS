<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Endpoint di compatibilità upload.php
 * Gestisce sia richieste form tradizionali sia chiamate AJAX
 */

require_once __DIR__ . '/includes/app_functions.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pvId = $_POST['pv_id'] ?? ($_GET['pv'] ?? null);
    $espositoreId = $_POST['espositore_id'] ?? ($_GET['espositore'] ?? null);
    $notes = $_POST['notes'] ?? '';

    if ($pvId && $espositoreId && isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $guid = generateGUID();
        $targetFilename = $guid . '.jpeg';
        $destPath = DIR_UPLOAD . DIRECTORY_SEPARATOR . $targetFilename;
        $publicPath = 'upload/' . $targetFilename;

        if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
            $currentUser = getCurrentUser();
            $username = $currentUser['username'] ?? 'agente';
            saveScatto($pvId, (int)$espositoreId, $targetFilename, $publicPath, $username, $notes);
            
            // Redirect alla vista PV
            header('Location: shops.php?pv=' . urlencode($pvId) . '&uploaded=1');
            exit;
        }
    }
}

header('Location: shops.php');
exit;
