<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Logout e distruzione della sessione
 */

require_once __DIR__ . '/includes/app_functions.php';

logoutUser();
header('Location: index.php');
exit;
