<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Pagina di Accesso / Login
 */

require_once __DIR__ . '/includes/app_functions.php';

if (isLoggedIn()) {
    header('Location: shops.php');
    exit;
}

$errorMsg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');
    
    if (!empty($username) && authenticateUser($username, $password)) {
        header('Location: shops.php');
        exit;
    } else {
        $errorMsg = 'Credenziali non valide. Verifica utente e password.';
    }
}
?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#E30613">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>WebApp Karma - Espositori</title>
  
  <link rel="shortcut icon" type="image/png" href="assets/brand/favicon-16x16.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="manifest" href="manifest.json">
  <link href="assets/css/modern.css" rel="stylesheet">
</head>
<body class="auth-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-logo-container">
          <img src="assets/brand/karma-logo.svg" alt="Karma Italiana" class="brand-logo">
        </div>
        <p class="auth-subtitle">Rilevazione fotografica e gestione espositori nei punti vendita</p>
      </div>

      <?php if (!empty($errorMsg)): ?>
        <div class="alert-error" role="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span><?= htmlspecialchars($errorMsg) ?></span>
        </div>
      <?php endif; ?>

      <form method="POST" action="index.php" class="auth-form" id="loginForm">
        <div class="form-group">
          <label for="username">Nome Utente</label>
          <div class="input-with-icon">
            <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input type="text" name="username" id="username" class="form-control" placeholder="es. bruno" required autocomplete="username" autofocus>
          </div>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="input-with-icon">
            <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input type="password" name="password" id="password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
          </div>
        </div>

        <div class="form-row-remember">
          <label class="checkbox-container">
            <input type="checkbox" name="rememberme" value="remember-me" checked>
            <span class="checkmark"></span>
            <span class="label-text">Ricordami su questo dispositivo</span>
          </label>
        </div>

        <button type="submit" class="btn-primary btn-block" name="cmdConfirm" value="cmdConfirm">
          <span>Accedi al Sistema</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>

      <!-- Accesso rapido demo per facilitare i test -->
      <div class="quick-access">
        <span class="quick-title">Accesso rapido test:</span>
        <div class="quick-chips">
          <button type="button" class="chip" onclick="quickFill('bruno', 'password')">
            👤 Bruno (Agente)
          </button>
          <button type="button" class="chip" onclick="quickFill('massimiliano', 'karma')">
            ⭐ Massimiliano (Admin)
          </button>
        </div>
      </div>

      <div class="auth-footer">
        <p>&copy; <?= date('Y') ?> Karma Italiana Srl &bull; WCAM 2.0</p>
      </div>
    </div>
  </div>

  <script>
    function quickFill(user, pass) {
      document.getElementById('username').value = user;
      document.getElementById('password').value = pass;
      document.getElementById('loginForm').submit();
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW fail:', err));
      });
    }
  </script>
</body>
</html>
