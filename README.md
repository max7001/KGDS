# WebApp Karma Espositori (WCAM 2.8) - Edizione Vercel / Firebase

Applicazione web progressiva (PWA / Mobile-First SPA) sviluppata per **Karma Italiana Srl** per la rilevazione fotografica e la verifica dell'allestimento espositori nei punti vendita da parte degli agenti.

---

## 🌟 Architettura del Sistema

### 1. Dati in Lettura (Server Karma Italiana)
Tutti i dati anagrafici e operativi rimangono agganciati al backend storico di **`www.karmaitaliana.it/wcam/`**:
- Elenco Catene Retail (Groups)
- Elenco Punti Vendita (Shops)
- Catalogo Esposizioni da monitorare
- Giacenze di Magazzino (Stock)
- Autenticazione agenti

### 2. Archiviazione Foto, Visite e Statistiche Esclusivamente su Firebase Cloud
Tutte le fotografie acquisite, le visite completate e il tracciamento delle date di visita sono gestite in modo sicuro e permanente su **Firebase** (progetto `app-create-con-ai`):
- **Date Ultima Visita**: archiviate e lette **esclusivamente da Firebase Cloud Firestore** (collezione `shop_visits`), garantendo assoluta precisione e calcolo dinamico dei giorni trascorsi.
- **Fotografie Allestimenti**: archiviate nel cloud di Firebase.
- **Record Statistici**: salvati in tempo reale su Firestore nella collezione `visits` e `inspections`.
- **Dashboard Statistiche Generali**: consultabile premendo il simbolo 📊.
- **Pannello AMMINISTRATORE (per utente `mborri`)**: riquadro dedicato con menu a tendina per supervisionare tutti i 22 agenti commerciali Karma, visualizzando catene abbinate, punti vendita, visite e foto per ciascun agente.

### 3. Sicurezza Totale delle Chiavi API
> [!IMPORTANT]
> **Nessuna chiave API o dato sensibile è esposto nel codice client (HTML/JS)**.
> Tutte le chiamate verso Firebase transitano tramite endpoint serverless dedicati (`/api/save-inspection` e `/api/stats`), garantendo che il codice sorgente distribuito agli agenti e visualizzabile dal browser rimanga completamente privo di credenziali.

---

## 📁 Struttura della Cartella `karma-wcam`

```
Progetti Antigravity 3/
└── karma-wcam/
    ├── index.html                # Entrypoint SPA (WCAM v2.2)
    ├── vercel.json               # Regole di Edge Rewrites per Vercel
    ├── manifest.json             # PWA Web App Manifest
    ├── sw.js                     # Service Worker per performance e caching
    ├── .env.example              # Template variabili d'ambiente opzionali per Vercel
    ├── api/
    │   ├── save-inspection.js    # Vercel Serverless Function: salvataggio sicuro foto e stats su Firebase
    │   └── stats.js              # Vercel Serverless Function: statistiche aggregate da Firestore
    ├── assets/
    │   ├── brand/                # Loghi ufficiali Karma e Rídem
    │   ├── css/
    │   │   ├── style.css         # Design system, layout compatto su 2 righe, modali e stili
    │   │   └── camera.css        # Viewport fotocamera e ghost overlay
    │   └── js/
    │       ├── api.js            # Client API sicuro senza chiavi esposte
    │       ├── app.js            # Router SPA, controller viste e statistiche
    │       ├── camera.js         # Motore fotocamera WebRTC + fallback nativo
    │       └── editor.js         # Studio di confronto planigramma ghost e compressione
    ├── test_server.py            # Server di sviluppo locale con simulatore Firebase
    └── README.md                 # Questa guida
```

---

## 🚀 Come Pubblicare su VERCEL

1. Carica il contenuto della cartella `karma-wcam` su un repository GitHub.
2. Accedi alla dashboard di [Vercel](https://vercel.com) e clicca su **"Add New... -> Project"**.
3. Importa il repository GitHub.
4. *(Opzionale)* In **Settings -> Environment Variables** su Vercel puoi configurare:
   - `FIREBASE_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   *(Se non impostate, le funzioni serverless utilizzano i parametri predefiniti di Firebase già configurati).*
5. Clicca su **"Deploy"**. L'applicazione sarà online e attiva in meno di un minuto!

---

## 💻 Come Collaudare in Locale

Il server locale `test_server.py` implementa nativamente sia il proxy verso `karmaitaliana.it` che gli endpoint di salvataggio verso Firebase:

1. Apri un terminale nella cartella `karma-wcam`:
   ```powershell
   python test_server.py
   ```
2. Accedi dal browser:
   - Dal computer: **`http://localhost:8080`**
   - Da smartphone / tablet: **`http://[TUO_IP_LOCALE]:8080`**

---

&copy; 2026 Karma Italiana Srl &bull; WCAM 2.8
