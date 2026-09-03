<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * API: Restituzione dati Punti Vendita, Espositori e stato scatti
 */

require_once __DIR__ . '/../includes/app_functions.php';

header('Content-Type: application/json; charset=utf-8');

$currentUser = getCurrentUser();
$pvId = $_GET['pv_id'] ?? null;

$puntiVendita = getPuntiVendita();
$allEspositori = getEspositoriList();
$espositoriMap = [];
foreach ($allEspositori as $e) {
    $espositoriMap[$e['id']] = $e;
}

// Calcola lo stato di completamento per ciascun PV
$pvListWithStats = [];
foreach ($puntiVendita as $pv) {
    $scatti = getScattiByPv($pv['id']);
    $completedCount = count($scatti);
    $totalCount = count($pv['espositori_ids'] ?? []);
    $percent = $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0;
    
    $pvCopy = $pv;
    $pvCopy['completed_count'] = $completedCount;
    $pvCopy['total_count'] = $totalCount;
    $pvCopy['progress_percent'] = $percent;
    $pvListWithStats[] = $pvCopy;
}

// Se richiesto uno specifico PV, restituisci anche il dettaglio degli espositori con stato foto
$selectedPvDetails = null;
if ($pvId) {
    $selectedPv = getPuntoVenditaById($pvId);
    if ($selectedPv) {
        $assignedEspositori = [];
        $scatti = getScattiByPv($pvId);
        $scattiMap = [];
        foreach ($scatti as $s) {
            $scattiMap[$s['espositore_id']] = $s;
        }

        foreach ($selectedPv['espositori_ids'] as $eId) {
            if (isset($espositoriMap[$eId])) {
                $item = $espositoriMap[$eId];
                $scatto = $scattiMap[$eId] ?? null;
                $item['completed'] = ($scatto !== null);
                $item['scatto'] = $scatto;
                $assignedEspositori[] = $item;
            }
        }

        $selectedPvDetails = [
            'pv' => $selectedPv,
            'espositori' => $assignedEspositori,
            'completed_count' => count($scatti),
            'total_count' => count($assignedEspositori),
            'progress_percent' => count($assignedEspositori) > 0 ? round((count($scatti) / count($assignedEspositori)) * 100) : 0
        ];
    }
}

sendJsonResponse([
    'status' => 'success',
    'user' => $currentUser,
    'punti_vendita' => $pvListWithStats,
    'selected_pv' => $selectedPvDetails
]);
