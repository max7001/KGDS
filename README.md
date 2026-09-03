# WebApp Karma Espositori (WCAM 2.0) - Edizione Vercel / HTML5

Applicazione web progressiva (PWA / Mobile-First SPA) sviluppata per **Karma Italiana Srl** per la rilevazione fotografica e la verifica dell'allestimento espositori nei punti vendita da parte degli agenti.

Progettata specificamente per essere pubblicata su **VERCEL** come webapp statica (HTML5, CSS3, JavaScript moderno), senza necessità di server o database dedicati su Vercel: tutti i dati, l'autenticazione e il salvataggio delle fotografie sono collegati in tempo reale al database e backend di **`https://www.karmaitaliana.it/wcam/`**.

---

## 🌟 Caratteristiche Principali

### 1. Architettura Vercel Senza Server (Zero-Config Backend)
- **100% Frontend Statico**: Funziona su qualsiasi browser (iOS Safari su iPhone, Chrome su Android, Edge, Firefox, Mac e PC).
- **Connessione Diretta al DB di Karma**: Tramite il file `vercel.json` con *Edge Rewrites*, tutte le chiamate API verso `/api/wcam/...` vengono inoltrate da Vercel a `https://www.karmaitaliana.it/wcam/...`, preservando i cookie di sessione (`PHPSESSID`) e superando qualsiasi problema di blocco CORS del browser.
- **Sicurezza delle Credenziali**: Nessuna password o dato sensibile è inserito nel codice sorgente. L'agente effettua il login sicuro inserendo le proprie credenziali operative.
- **Installabile come App (PWA)**: Grazie a `manifest.json` e al Service Worker `sw.js`, l'agente può aggiungere l'icona alla schermata Home del telefono per un'esperienza a schermo intero.

### 2. Dashboard Completa a 4 Livelli Informativi
1. **Schermata Login**: Brand identity Karma Italiana e Rídem, opzione "Ricorda utente" (salva solo il nome utente in locale per comodità, mai la password).
2. **Catene Retail (Groups)**: Elenco dei gruppi assegnati all'agente (*es. BRUNO, COMET, UNIEURO*) con badge del numero di PV e indicazione dell'ultimo negozio visitato.
3. **Punti Vendita (Shops)**:
   - Ricerca live istantanea per città o denominazione.
   - Ordinamento con un tocco: per *Nome* o per *Data Ultima Visita*.
   - Consultazione istantanea delle **Giacenze di Magazzino** del negozio.
4. **Espositori (Exhibitors)**:
   - Barra di avanzamento dinamica dell'allestimento (*es. "3 su 4 completati (75%)"*).
   - Card differenziate per stato: verde con badge *Foto OK* per quelli già rilevati, rosso per quelli da fotografare.
   - Pulsanti one-tap per consultare la foto dell'**Esposizione Ideale** e lo schema del **Planigramma** ufficiale da CDN Karma.

### 3. Modulo Fotocamera Potenziato & Ghost Overlay
- **Doppio Motore di Scatto (Dual-Engine)**:
  - *Streaming HD WebRTC dal vivo*: con griglia dei terzi e regolazione della trasparenza in tempo reale.
  - *Fotocamera Nativa Smartphone*: garantisce il 100% di compatibilità anche su browser mobili con restrizioni di sicurezza.
- **Ghost Planigramma Overlay Slider (0% - 100%)**:
  - Sia durante l'inquadratura che nella schermata di verifica post-scatto, l'agente può far scorrere uno slider di trasparenza per **sovrapporre il vero planigramma ufficiale sopra la foto**, verificando con precisione millimetrica l'allineamento dei prodotti prima del salvataggio!
- **Strumenti di Ritocco Integrati**:
  - Rotazione 90° con elaborazione grafica su Canvas.
  - Auto-Contrasto / Luminosità per corsie o angoli bui.
- **Compressione Intelligente Client-Side**:
  - Ridimensiona le immagini (max 1920px, qualità ottimizzata) riducendo le foto da 8-12 MB a circa 300 KB prima dell'invio, garantendo caricamenti ultra-rapidi anche in punti vendita con segnale mobile debole (3G/4G).

---

## 🚀 Come Pubblicare su VERCEL

L'applicazione è già pronta per Vercel. Puoi pubblicarla in due modalità:

### Opzione A: Tramite GitHub (Consigliata)
1. Carica questa cartella su un repository GitHub (pubblico o privato).
2. Vai sulla dashboard di [Vercel](https://vercel.com) e clicca su **"Add New... -> Project"**.
3. Seleziona il repository GitHub appena creato.
4. Nella schermata di configurazione:
   - **Framework Preset**: lascia `Other`
   - **Root Directory**: `.` (radice)
5. Clicca su **"Deploy"**. In meno di 30 secondi la tua webapp sarà online su un URL pubblico (es. `https://tuo-progetto.vercel.app`) con HTTPS e proxy attivi!

### Opzione B: Tramite Vercel CLI
1. Apri il terminale nella cartella del progetto:
   ```bash
   npx vercel
   ```
2. Segui i passaggi guidati a schermo per collegare il tuo account Vercel ed eseguire il deploy.

---

## 💻 Come Collaudare in Locale

Il file `test_server.py` include un simulatore locale del proxy di Vercel:

1. Avvia il server:
   ```bash
   python test_server.py
   ```
2. Apri il browser all'indirizzo:
   - **Dal computer**: `http://localhost:8080`
   - **Da smartphone / tablet sulla stessa rete Wi-Fi**: `http://[TUO_IP_LOCALE]:8080`
3. Inserisci le tue credenziali di Karma Italiana per accedere in tempo reale ai dati del database.

---

## 📂 Struttura dei File

```
Progetti Antigravity 3/
├── index.html                # Entrypoint Single Page Application per Vercel
├── vercel.json               # Configurazione proxy Vercel (Edge Rewrites verso karmaitaliana.it)
├── manifest.json             # Manifest PWA per installazione come app su smartphone
├── sw.js                     # Service Worker per caching e performance
├── assets/
│   ├── brand/                # Loghi vettoriali ufficiali Karma e Rídem
│   ├── css/
│   │   ├── style.css         # Design system, layout responsive, viste SPA e modali
│   │   └── camera.css        # Viewport fotocamera, griglia, ghost overlay e revisione
│   └── js/
│       ├── api.js            # Client HTTP per il backend Karma (gestione sessione e dati)
│       ├── app.js            # Router SPA, stato applicazione, filtri e navigazione
│       ├── camera.js         # Motore fotocamera WebRTC + fallback nativo mobile
│       └── editor.js         # Studio di confronto planigramma ghost, rotazione e compressione
├── test_server.py            # Simulatore locale del proxy Vercel per collaudo immediato
└── README.md                 # Documentazione completa
```

---

&copy; 2026 Karma Italiana Srl &bull; All Rights Reserved
