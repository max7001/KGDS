<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Configurazione, gestione sessioni e connessione Database
 */

require_once __DIR__ . '/app_costants.php';

// Configurazione Sessione
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    ini_set('session.cookie_lifetime', 60 * 60 * 24 * 30); // 30 giorni per remember-me
    session_start();
}

// Parametri Database MySQL (XAMPP / Server Karma)
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'karma_wcam');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

/**
 * Connessione al database con fallback trasparente
 * Ritorna un'istanza PDO o null se in modalità file-based fallback
 */
function connectToDB() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 2,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (Throwable $e) {
        // Fallback su database JSON se MySQL non è avviato o non configurato
        return null;
    }
}
