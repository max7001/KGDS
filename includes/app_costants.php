<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Costanti globali dell'applicazione
 */

if (!defined('APP_INIT')) {
    define('APP_INIT', true);
}

define('APP_NAME', 'WebApp Karma - Espositori');
define('APP_VERSION', '2.5.0');
define('APP_AUTHOR', 'Karma Italiana Srl');
define('APP_YEAR', date('Y'));

// Percorsi
define('DIR_ROOT', dirname(__DIR__));
define('DIR_INCLUDES', DIR_ROOT . DIRECTORY_SEPARATOR . 'includes');
define('DIR_UPLOAD', DIR_ROOT . DIRECTORY_SEPARATOR . 'upload');
define('DIR_DATA', DIR_ROOT . DIRECTORY_SEPARATOR . 'data');
define('DIR_ASSETS', 'assets');

// Parametri upload
define('MAX_UPLOAD_SIZE_MB', 25);
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'webp']);
define('TARGET_IMAGE_MAX_DIM', 2560); // Max resolution px (width or height)
define('THUMBNAIL_MAX_DIM', 480);
