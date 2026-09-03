# WebApp Karma - Espositori (WCAM 2.0)

Applicazione web progressiva (PWA / Mobile-First) di **Karma Italiana Srl** per la rilevazione fotografica e gestione dell'allestimento espositori nei punti vendita.

Reingegnerizzazione completa del software presente su `https://www.karmaitaliana.it/wcam/`, con nuova interfaccia grafica curata, modulo fotocamera professionale ad alta definizione, guida planigramma in sovrimpressione trasparente (*Ghost Overlay*), controlli hardware e supporto resiliente alla connettività debole/offline.

---

## 🚀 Novità e Miglioramenti Chiave rispetto alla Versione Precedente

### 1. Grafica & Interfaccia Utente (UI/UX)
- **Karma Design System**: Palette istituzionale con rosso Karma (`#E30613`), contrasti ad alta leggibilità, card con angoli arrotondati morbidi, glassmorphism e tipografia moderna (*Plus Jakarta Sans*).
- **Esperienza Mobile App (PWA)**: Dotata di `manifest.json` e Service Worker (`sw.js`). L'agente o merchandiser può installare l'app direttamente sulla schermata Home del proprio smartphone iOS o Android e utilizzarla a schermo intero senza barre del browser.
- **Riepilogo e Avanzamento in Tempo Reale**: Per ciascun Punto Vendita (es. *"PV Verona - BRUNO"*) viene mostrata una barra dinamica con la percentuale di allestimento e il conteggio esatto (*es. "2 di 4 espositori completati (50%)"*).
- **Ricerca e Filtri Istantanei**: Barra di ricerca live e chip di filtro (*Tutti*, *Da fare*, *Fatti*) senza necessità di ricaricare la pagina.
- **Stato Foto Differenziato**: Gli espositori già rilevati assumono badge verde (*Foto Acquisita*) con pulsanti per visionare lo scatto o rieseguirlo; quelli ancora da rilevare presentano un pulsante rapido di scatto ben visibile.

### 2. Modulo di Acquisizione Fotografica Nettamente Migliorato
- **Live Viewfinder WebRTC a Schermo Intero**: Accesso diretto e fluido al sensore fotocamera in risoluzione HD / 1080p.
- **Ghost Overlay (Planigramma Trasparente)**: Sovrappone lo schema del planigramma di riferimento direttamente sopra l'inquadratura live della fotocamera, con uno slider di regolazione trasparenza (10% - 90%). L'operatore può così allineare con precisione millimetrica l'espositore reale allo standard aziendale Karma!
- **Griglia dei Terzi e Allineamento Orizzontale**: Guide visive per centrare l'espositore perpendicolarmente ed evitare distorsioni prospettiche.
- **Switch Fotocamera**: Pulsante one-tap per alternare fotocamera posteriore (grandangolare/ambiente) e anteriore.
- **Torcia LED (Torch Constraint)**: Attivazione della torcia per illuminare banchi o corsie scarsamente illuminate nei punti vendita.
- **Editor Pre-Invio & Revisione**:
  - Verifica dello scatto prima del caricamento.
  - Rotazione rapida 90° oraria su canvas.
  - Ottimizzazione automatica di luminosità e contrasto per foto scure.
  - Campo note opzionale per segnalare anomalie (es. cartellini mancanti o prodotti esauriti).
- **Compressione Intelligente Lato Client**: Ridimensionamento e compressione JPEG/WebP istantanea (da ~8MB a ~300KB) direttamente nel browser del telefono prima dell'invio. Questo azzera i tempi di attesa e permette l'invio anche in 3G/4G debole.
- **Coda di Salvataggio Offline**: Se all'interno del negozio la connessione internet si interrompe, la foto viene conservata nella memoria locale del dispositivo e inviata non appena il segnale viene ripristinato.
- **Doppia Modalità**: Possibilità di scattare dal vivo oppure selezionare una fotografia già presente nella Galleria del telefono.

### 3. Backend e Compatibilità
- **Identificativi GUID Nativi**: Ogni foto salvata viene nominata con identificativo Windows GUID (es. `0A10192B-D422-4DA1-B185-E35CAD79B0A8.jpeg`) e salvata nella cartella `upload/`, mantenendo la compatibilità con lo storico dell'archivio Karma.
- **Doppia Compatibilità di Esecuzione**:
  - **Server Apache / XAMPP (Produzione)**: File PHP 7.4 / 8.x puliti e pronti per essere posizionati in `C:\xampp\htdocs\wcam\`.
  - **Server Locale Python (Test Immediato)**: Script autonomo `test_server.py` per provare l'intero software subito su qualsiasi PC senza dover installare o configurare nulla.

---

## 📁 Struttura del Progetto

```
Progetti Antigravity 3/
├── index.php                 # Schermata di login moderna con accesso rapido test
├── shops.php                 # Dashboard Punti Vendita, avanzamento e lista espositori
├── camera.php                # Modulo fotocamera fullscreen, controlli e ghost overlay
├── upload.php                # Script di compatibilità per upload tradizionali
├── logout.php                # Chiusura sessione utente
├── manifest.json             # Manifest PWA per installazione su smartphone
├── sw.js                     # Service Worker per caching e supporto offline
├── test_server.py            # Server Python autonomo per collaudo immediato (porta 8080)
├── api/
│   ├── get_data.php          # API REST: Punti Vendita, espositori e stato scatti
│   └── save_photo.php        # API REST: Ricezione, validazione e salvataggio foto
├── includes/
│   ├── app_config.php        # Connessione DB (MySQL con fallback automatico JSON)
│   ├── app_costants.php      # Costanti di configurazione e percorsi
│   └── app_functions.php     # Funzioni di autenticazione, repository e utilità GUID
├── assets/
│   ├── brand/                # Loghi vettoriali SVG Karma Italiana e Rídem, favicon
│   ├── css/
│   │   ├── modern.css        # Stili generali, tema Karma, layout responsive
│   │   └── camera.css        # Stili mirati per fotocamera fullscreen ed editor scatti
│   ├── js/
│   │   ├── app.js            # Controller dashboard, filtri e modali
│   │   ├── camera-engine.js  # Motore WebRTC, switch camera, torcia, ghost overlay
│   │   └── image-editor.js   # Ritaglio, rotazione, auto-enhance, compressione e upload
│   └── images/               # Planigrammi, foto campioni di allestimento ed esempi
├── data/
│   └── database.json         # Database locale di seed e fallback
└── upload/                   # Cartella di destinazione delle fotografie scattate
```

---

## 🛠️ Come Avviare il Test in Locale

Per collaudare subito l'applicazione sul tuo computer senza Apache né MySQL:

1. Apri un terminale PowerShell nella cartella del progetto:
   ```powershell
   python test_server.py
   ```
2. Apri il browser all'indirizzo:
   ```
   http://localhost:8080
   ```
3. Credenziali di prova:
   - **Agente**: Utente `bruno` &bull; Password `password`
   - **Admin**: Utente `massimiliano` &bull; Password `karma`
   *(puoi anche cliccare direttamente sui chip "Accesso rapido test" nella schermata di login)*.

---

## 🌐 Come Distribuire in Produzione (Server Apache / XAMPP)

Per pubblicare la nuova versione sul server Apache esistente:

1. Copia il contenuto della cartella `Progetti Antigravity 3` all'interno della directory del server web (es. `C:\xampp\htdocs\wcam\`).
2. Verifica che la cartella `upload/` abbia i permessi di scrittura per l'utente Apache/PHP.
3. Se desideri collegarla al database MySQL, imposta i parametri in `includes/app_config.php` (l'applicazione supporta comunque il fallback automatico su file JSON qualora il DB MySQL non fosse attivo).
