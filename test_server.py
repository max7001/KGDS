#!/usr/bin/env python3
"""
WebApp Karma - Espositori (WCAM 2.0)
Server di collaudo multi-thread per utenti interni ed esterni.
Supporta accessi concorrenti da desktop e smartphone sulla rete locale.
"""

import http.server
import socketserver
import urllib.parse
import json
import os
import re
import uuid
import base64
import socket
from datetime import datetime

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "database.json")
UPLOAD_DIR = os.path.join(BASE_DIR, "upload")

os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def load_db():
    if not os.path.exists(DATA_FILE):
        return {"users": [], "punti_vendita": [], "espositori": [], "scatti": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def generate_guid():
    return str(uuid.uuid4()).upper()

# Session store in memory
sessions = {}

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

class KarmaAppHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Stampa log sintetico
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} - {format % args}")

    def get_session(self):
        cookies = self.headers.get('Cookie', '')
        m = re.search(r'karma_session=([a-zA-Z0-9_-]+)', cookies)
        if m:
            sid = m.group(1)
            if sid in sessions:
                return sid, sessions[sid]
        return None, None

    def set_session(self, user_dict):
        sid = generate_guid()
        sessions[sid] = user_dict
        return sid

    def send_redirect(self, location, set_cookie=None):
        self.send_response(302)
        self.send_header('Location', location)
        if set_cookie:
            self.send_header('Set-Cookie', f'karma_session={set_cookie}; Path=/; HttpOnly; SameSite=Lax')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send_json(self, data, code=200):
        body = json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.lstrip('/')
        params = urllib.parse.parse_qs(parsed.query)

        sid, user = self.get_session()

        # Root redirect
        if path in ['', 'index.html', 'index.php']:
            if user:
                return self.send_redirect('shops.php')
            return self.serve_login_page()

        elif path == 'logout.php':
            if sid in sessions:
                del sessions[sid]
            return self.send_redirect('index.php', set_cookie='deleted; Max-Age=0')

        elif path == 'shops.php':
            if not user:
                return self.send_redirect('index.php')
            pv_id = params.get('pv', ['pv-verona'])[0]
            return self.serve_shops_page(user, pv_id)

        elif path == 'camera.php':
            if not user:
                return self.send_redirect('index.php')
            pv_id = params.get('pv', ['pv-verona'])[0]
            esp_id = int(params.get('espositore', ['101'])[0])
            return self.serve_camera_page(pv_id, esp_id)

        elif path == 'api/get_data.php':
            db = load_db()
            pv_id = params.get('pv_id', [None])[0]
            return self.send_json({
                'status': 'success',
                'user': user,
                'punti_vendita': db['punti_vendita']
            })

        # Static files handling
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.lstrip('/')
        length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(length)

        sid, user = self.get_session()

        if path in ['index.php', 'login']:
            params = urllib.parse.parse_qs(post_data.decode('utf-8', errors='ignore'))
            username = params.get('username', [''])[0].strip()
            password = params.get('password', [''])[0].strip()

            db = load_db()
            matched = None
            for u in db['users']:
                if u['username'].lower() == username.lower():
                    matched = u
                    break
            
            if not matched and username.lower() in ['bruno', 'massimiliano', 'admin', 'karma']:
                matched = {'id': 99, 'username': username, 'name': username.capitalize(), 'role': 'agent'}

            if matched:
                new_sid = self.set_session(matched)
                return self.send_redirect('shops.php', set_cookie=new_sid)
            else:
                return self.serve_login_page(error_msg='Credenziali non valide. Riprova.')

        elif path in ['api/save_photo.php', 'save_photo']:
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                data = urllib.parse.parse_qs(post_data.decode('utf-8', errors='ignore'))
                data = {k: v[0] for k, v in data.items()}

            pv_id = data.get('pv_id')
            espositore_id = int(data.get('espositore_id', 0))
            notes = data.get('notes', '')
            image_base64 = data.get('image_base64', '')

            if not pv_id or not espositore_id or not image_base64:
                return self.send_json({'status': 'error', 'message': 'Parametri mancanti'}, 400)

            guid = generate_guid()
            filename = f"{guid}.jpeg"
            filepath = os.path.join(UPLOAD_DIR, filename)

            if 'base64,' in image_base64:
                image_base64 = image_base64.split('base64,')[1]

            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(image_base64))

            db = load_db()
            db['scatti'] = [s for s in db['scatti'] if not (s['pv_id'] == pv_id and s['espositore_id'] == espositore_id)]
            new_record = {
                'id': guid,
                'pv_id': pv_id,
                'espositore_id': espositore_id,
                'filename': filename,
                'filepath': f"upload/{filename}",
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'uploaded_by': user['username'] if user else 'agente',
                'status': 'approved',
                'notes': notes
            }
            db['scatti'].append(new_record)
            save_db(db)

            return self.send_json({
                'status': 'success',
                'message': 'Foto salvata!',
                'guid': guid,
                'filename': filename,
                'filepath': f"upload/{filename}"
            })

        return super().do_POST()

    def serve_login_page(self, error_msg=''):
        with open(os.path.join(BASE_DIR, 'index.php'), 'r', encoding='utf-8') as f:
            content = f.read()

        # Rimuovi blocco PHP iniziale
        content = re.sub(r'<\?php.*?\?>', '', content, count=1, flags=re.DOTALL)

        if error_msg:
            err_html = f'<div class="alert-error"><span>{error_msg}</span></div>'
            content = re.sub(r'<\?php if \(!empty\(\$errorMsg\)\): \?>.*?<\?php endif; \?>', err_html, content, flags=re.DOTALL)
        else:
            content = re.sub(r'<\?php if \(!empty\(\$errorMsg\)\): \?>.*?<\?php endif; \?>', '', content, flags=re.DOTALL)

        content = re.sub(r'<\?=\s*date\(\'Y\'\)\s*\?>', '2026', content)
        content = re.sub(r'<\?php.*?\?>', '', content, flags=re.DOTALL)

        body = content.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_shops_page(self, user, pv_id):
        db = load_db()
        pv = next((p for p in db['punti_vendita'] if p['id'] == pv_id), db['punti_vendita'][0])
        all_espositori = {e['id']: e for e in db['espositori']}
        
        assigned_espositori = [all_espositori[eid] for eid in pv.get('espositori_ids', []) if eid in all_espositori]
        scatti = [s for s in db['scatti'] if s['pv_id'] == pv['id']]
        scatti_map = {s['espositore_id']: s for s in scatti}

        completed = len(scatti)
        total = len(assigned_espositori)
        percent = round((completed / total) * 100) if total > 0 else 0

        with open(os.path.join(BASE_DIR, 'shops.php'), 'r', encoding='utf-8') as f:
            content = f.read()

        content = re.sub(r'<\?php.*?\?>', '', content, count=1, flags=re.DOTALL)

        # 1. Punti Vendita Dropdown
        opts = "".join([f'<option value="{p["id"]}" {"selected" if p["id"] == pv["id"] else ""}>{p["name"]}</option>' for p in db['punti_vendita']])
        content = re.sub(r'<\?php foreach \(\$puntiVendita as \$pv\):.*?\?>.*?<\?php endforeach; \?>', opts, content, flags=re.DOTALL)

        # 2. Espositori Cards Loop
        cards_html = ""
        for esp in assigned_espositori:
            has_photo = esp['id'] in scatti_map
            scatto = scatti_map.get(esp['id'])
            swirl_class = "swirl-done" if has_photo else ""
            card_class = "card-completed" if has_photo else "card-pending"
            swirl_color = "#10B981" if has_photo else "#E30613"
            
            badge_html = f'<span class="badge-done"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Foto Acquisita</span>' if has_photo else '<span class="badge-pending">Da fotografare</span>'
            
            if has_photo:
                action_html = f'''
                <div class="done-actions">
                  <button type="button" class="btn-review-photo" onclick="previewTakenPhoto('{esp["title"]}', '{scatto["filepath"]}', '{scatto["timestamp"]}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>Vedi Scatto</span>
                  </button>
                  <a href="camera.php?pv={pv['id']}&espositore={esp['id']}" class="btn-retake">Rifai scatto</a>
                </div>'''
            else:
                action_html = f'''
                <a href="camera.php?pv={pv['id']}&espositore={esp['id']}" class="btn-shoot-action">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  <span>Scatta Foto</span>
                </a>'''

            cards_html += f'''
            <article class="espositore-card {card_class}" data-id="{esp['id']}" data-title="{esp['title'].lower()}" data-cat="{esp['category'].lower()}" data-status="{'done' if has_photo else 'pending'}">
              <div class="card-left-visual">
                <div class="brand-swirl-icon {swirl_class}">
                  <svg viewBox="0 0 70 70" width="40" height="40">
                    <circle cx="35" cy="35" r="34" fill="{swirl_color}"/>
                    <path d="M 35 11 A 24 24 0 0 1 59 35 C 59 48.2 48.2 59 35 59 C 24 59 18 51 24 43 C 28 37 36 37 38 41 C 39 43 38 46 35 46 C 31 46 29 41 33 37 C 37 33 46 36 45 42 C 44 49 34 52 28 47 C 22 42 23 27 35 21 Z" fill="#FFFFFF"/>
                    <circle cx="35" cy="35" r="5" fill="{swirl_color}"/>
                  </svg>
                </div>
              </div>
              <div class="card-body-content">
                <div class="card-meta-row">
                  <span class="category-tag">{esp['category']}</span>
                  {badge_html}
                </div>
                <h2 class="card-title">{esp['title']}</h2>
                <p class="card-subtitle">{esp['subtitle']}</p>
                <div class="card-guides-actions">
                  <button type="button" class="btn-guide-link" onclick="openPlanogramModal('{esp['title']}', '{esp['planigramma_img']}', '{esp['target_img']}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    Vedi Planigramma Ideale
                  </button>
                </div>
              </div>
              <div class="card-action-col">
                {action_html}
              </div>
            </article>'''

        content = re.sub(r'<\?php foreach \(\$assignedEspositori as \$esp\):.*?\?>.*?<\?php endforeach; \?>', cards_html, content, flags=re.DOTALL)

        content = content.replace("<?= htmlspecialchars($currentPv['name']) ?>", pv['name'])
        content = content.replace("<?= htmlspecialchars($currentPv['city']) ?>", pv.get('city', ''))
        content = content.replace("<?= htmlspecialchars($currentPv['address']) ?>", pv.get('address', ''))
        content = content.replace("<?= htmlspecialchars($user['name'] ?? 'Utente') ?>", user.get('name', 'Bruno'))
        content = content.replace("<?= strtoupper(substr($user['name'] ?? 'U', 0, 1)) ?>", user.get('name', 'B')[0].upper())
        content = content.replace("<?= $completedCount ?>", str(completed))
        content = content.replace("<?= $totalCount ?>", str(total))
        content = content.replace("<?= $percent ?>", str(percent))
        content = content.replace("<?= $totalCount - $completedCount ?>", str(total - completed))
        content = content.replace("<?= $percent === 100 ? 'status-complete' : 'status-progress' ?>", 'status-complete' if percent == 100 else 'status-progress')
        content = content.replace("<?= $percent === 100 ? '✓ Verificato' : 'In Rilevazione' ?>", '✓ Verificato' if percent == 100 else 'In Rilevazione')

        content = re.sub(r'<\?php.*?\?>', '', content, flags=re.DOTALL)

        body = content.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_camera_page(self, pv_id, esp_id):
        db = load_db()
        pv = next((p for p in db['punti_vendita'] if p['id'] == pv_id), db['punti_vendita'][0])
        esp = next((e for e in db['espositori'] if e['id'] == esp_id), db['espositori'][0])

        with open(os.path.join(BASE_DIR, 'camera.php'), 'r', encoding='utf-8') as f:
            content = f.read()

        content = re.sub(r'<\?php.*?\?>', '', content, count=1, flags=re.DOTALL)

        content = content.replace("<?= htmlspecialchars($currentEspositore['title']) ?>", esp['title'])
        content = content.replace("<?= htmlspecialchars($pv['name']) ?>", pv['name'])
        content = content.replace("<?= urlencode($pv['id']) ?>", pv['id'])
        content = content.replace("<?= htmlspecialchars($currentEspositore['planigramma_img']) ?>", esp['planigramma_img'])
        content = content.replace("<?= htmlspecialchars($currentEspositore['target_img']) ?>", esp['target_img'])
        content = content.replace("<?= htmlspecialchars($pv['id']) ?>", pv['id'])
        content = content.replace("<?= (int)$currentEspositore['id'] ?>", str(esp['id']))

        content = re.sub(r'<\?php.*?\?>', '', content, flags=re.DOTALL)

        body = content.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    local_ip = get_local_ip()
    with ThreadedTCPServer(("0.0.0.0", PORT), KarmaAppHandler) as httpd:
        print("============================================================")
        print(" WebApp Karma - Espositori (WCAM 2.0) [Multi-Thread Server]")
        print("============================================================")
        print(" Accedi dal tuo browser al seguente indirizzo:")
        print(f"   * Locale:       http://localhost:{PORT}")
        print(f"   * Rete Locale:  http://{local_ip}:{PORT}")
        print("============================================================")
        print(" Credenziali di accesso:")
        print("   - Agente:         bruno          / password")
        print("   - Amministratore: massimiliano   / karma")
        print("============================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer arrestato.")
