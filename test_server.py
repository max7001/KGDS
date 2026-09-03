#!/usr/bin/env python3
"""
WebApp Karma - Espositori (WCAM 2.0)
Server di sviluppo locale per Vercel SPA.
Simula esattamente il comportamento del reverse proxy di Vercel (vercel.json)
inoltrando le richieste /api/wcam/... direttamente a https://www.karmaitaliana.it/wcam/...
e servendo l'applicazione statica HTML5 per gli agenti.
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import urllib.error
import ssl
import sys
import os
import socket
import json
from datetime import datetime

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REMOTE_WCAM_BASE = "https://www.karmaitaliana.it/wcam"

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

class VercelDevProxyHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} - {format % args}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Se richiesta statistiche da Firebase
        if path == '/api/stats':
            return self.handle_get_stats()

        # Se richiesta proxy verso il backend Karma (/api/wcam/... o /api/karma-search)
        if path.startswith('/api/wcam') or path.startswith('/api/karma-search'):
            return self.proxy_to_karma(parsed, 'GET')

        # Se root, servi index.html
        if path in ['', '/', '/index.html']:
            return self.serve_index_html()

        # File statici ordinari
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Se salvataggio ispezione fotografica e statistiche su Firebase
        if path == '/api/save-inspection':
            return self.handle_save_inspection()

        if path.startswith('/api/wcam') or path.startswith('/api/karma-search'):
            return self.proxy_to_karma(parsed, 'POST')

        return super().do_POST()

    def handle_save_inspection(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length > 0 else b'{}'
        try:
            payload = json.loads(body.decode('utf-8'))
        except Exception:
            payload = {}

        api_key = os.environ.get("FIREBASE_API_KEY", "AIzaSyAEROCv8lYbMaxDVhg4u4kcfjGPO2UZL2M")
        project_id = os.environ.get("FIREBASE_PROJECT_ID", "app-create-con-ai")
        storage_bucket = os.environ.get("FIREBASE_STORAGE_BUCKET", "app-create-con-ai.firebasestorage.app")

        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat()
        date_str = timestamp.split('T')[0]

        img_b64 = payload.get('imageBase64', '')
        photo_url = None

        # 1. Prova upload su Firebase Storage
        if img_b64:
            try:
                import base64
                raw_b64 = img_b64.split('base64,')[-1] if 'base64,' in img_b64 else img_b64
                img_bytes = base64.b64decode(raw_b64)
                fname = f"inspections/{int(datetime.now().timestamp())}_{payload.get('shopId', '0')}_{payload.get('exId', '0')}.jpg"
                encoded_fname = urllib.parse.quote(fname, safe='')
                st_url = f"https://firebasestorage.googleapis.com/v0/b/{storage_bucket}/o?name={encoded_fname}&key={api_key}"
                st_req = urllib.request.Request(st_url, data=img_bytes, headers={'Content-Type': 'image/jpeg'})
                with urllib.request.urlopen(st_req, timeout=10) as st_resp:
                    if st_resp.status == 200:
                        photo_url = f"https://firebasestorage.googleapis.com/v0/b/{storage_bucket}/o/{encoded_fname}?alt=media"
            except Exception as st_err:
                pass

        # 2. Salva in Cloud Firestore
        fs_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/inspections?key={api_key}"
        doc_fields = {
            'agent': {'stringValue': payload.get('agent', 'Agente')},
            'chain': {'stringValue': payload.get('chain', 'Catena')},
            'groupId': {'stringValue': str(payload.get('groupId', ''))},
            'shop': {'stringValue': payload.get('shop', 'Punto Vendita')},
            'shopId': {'stringValue': str(payload.get('shopId', ''))},
            'exTitle': {'stringValue': payload.get('exTitle', 'Espositore')},
            'exId': {'stringValue': str(payload.get('exId', ''))},
            'timestamp': {'timestampValue': timestamp},
            'date': {'stringValue': date_str},
            'notes': {'stringValue': payload.get('notes', '')},
            'status': {'stringValue': 'completed'}
        }

        if photo_url:
            doc_fields['photoUrl'] = {'stringValue': photo_url}
        elif img_b64:
            doc_fields['photoBase64'] = {'stringValue': img_b64}

        fs_body = json.dumps({'fields': doc_fields}).encode('utf-8')
        fs_req = urllib.request.Request(fs_url, data=fs_body, headers={'Content-Type': 'application/json'})

        created_id = None
        try:
            with urllib.request.urlopen(fs_req, timeout=15) as fs_resp:
                fs_data = json.loads(fs_resp.read().decode('utf-8'))
                created_id = fs_data.get('name', '').split('/')[-1]
        except Exception as fs_ex:
            print("Errore scrittura Firestore:", fs_ex)

        # 3. Invio sincrono a karmaitaliana.it/wcam se presenti sessione e credenziali
        if payload.get('groupId') and payload.get('shopId') and payload.get('exId') and img_b64:
            try:
                karma_data = urllib.parse.urlencode({
                    'image': img_b64,
                    'exid': str(payload.get('exId')),
                    'shopid': str(payload.get('shopId')),
                    'groupid': str(payload.get('groupId')),
                    'cmdSave': 'Salva'
                }).encode('utf-8')
                k_headers = {'Content-Type': 'application/x-www-form-urlencoded'}
                if 'Cookie' in self.headers:
                    k_headers['Cookie'] = self.headers['Cookie']
                k_req = urllib.request.Request(f"{REMOTE_WCAM_BASE}/camera.php", data=karma_data, headers=k_headers)
                urllib.request.urlopen(k_req, timeout=10)
            except Exception:
                pass

        resp_payload = json.dumps({
            'success': True,
            'id': created_id or 'offline',
            'photoUrl': photo_url or 'firestore_inline',
            'timestamp': timestamp
        }).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(resp_payload)))
        self.end_headers()
        self.wfile.write(resp_payload)

    def handle_get_stats(self):
        api_key = os.environ.get("FIREBASE_API_KEY", "AIzaSyAEROCv8lYbMaxDVhg4u4kcfjGPO2UZL2M")
        project_id = os.environ.get("FIREBASE_PROJECT_ID", "app-create-con-ai")

        fs_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/inspections?pageSize=100&key={api_key}"
        inspections = []
        try:
            req = urllib.request.Request(fs_url)
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read().decode('utf-8'))
                for doc in data.get('documents', []):
                    f = doc.get('fields', {})
                    inspections.append({
                        'id': doc.get('name', '').split('/')[-1],
                        'agent': f.get('agent', {}).get('stringValue', 'Agente'),
                        'chain': f.get('chain', {}).get('stringValue', 'Catena'),
                        'shop': f.get('shop', {}).get('stringValue', 'Punto Vendita'),
                        'exTitle': f.get('exTitle', {}).get('stringValue', 'Espositore'),
                        'timestamp': f.get('timestamp', {}).get('timestampValue', ''),
                        'date': f.get('date', {}).get('stringValue', ''),
                        'photoUrl': f.get('photoUrl', {}).get('stringValue') or f.get('photoBase64', {}).get('stringValue'),
                        'notes': f.get('notes', {}).get('stringValue', '')
                    })
        except Exception as ex:
            print("Errore lettura Firestore per statistiche:", ex)

        inspections.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        by_chain = {}
        by_agent = {}
        for it in inspections:
            by_chain[it['chain']] = by_chain.get(it['chain'], 0) + 1
            by_agent[it['agent']] = by_agent.get(it['agent'], 0) + 1

        recent = inspections[:10]

        resp_body = json.dumps({
            'totalInspections': len(inspections),
            'recentInspections': recent,
            'inspectionsByChain': by_chain,
            'inspectionsByAgent': by_agent
        }).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)

    def serve_index_html(self):
        file_path = os.path.join(BASE_DIR, 'index.html')
        with open(file_path, 'rb') as f:
            content = f.read()

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(content)

    def proxy_to_karma(self, parsed, method):
        if parsed.path.startswith('/api/karma-search'):
            remote_url = "https://www.karmaitaliana.it/it/search.html"
            if parsed.query:
                remote_url += f"?{parsed.query}"
        else:
            # Rimuovi prefisso /api/wcam
            subpath = parsed.path[len('/api/wcam'):]
            if subpath.startswith('/'):
                subpath = subpath[1:]
            remote_url = f"{REMOTE_WCAM_BASE}/{subpath}"
            if parsed.query:
                remote_url += f"?{parsed.query}"

        # Leggi body per POST
        body = None
        if method == 'POST':
            length = int(self.headers.get('Content-Length', 0))
            if length > 0:
                body = self.rfile.read(length)

        # Prepara header per il server remoto
        headers = {
            'User-Agent': self.headers.get('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KarmaVercelApp/2.0'),
            'Accept': self.headers.get('Accept', '*/*')
        }

        if 'Cookie' in self.headers:
            headers['Cookie'] = self.headers['Cookie']

        if 'Content-Type' in self.headers:
            headers['Content-Type'] = self.headers['Content-Type']

        req = urllib.request.Request(remote_url, data=body, headers=headers, method=method)

        ctx = ssl.create_default_context()

        # Custom opener che NON segue automaticamente i redirect per conservare il cookie di sessione
        class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirectHandler, urllib.request.HTTPSHandler(context=ctx))

        try:
            try:
                resp = opener.open(req, timeout=20)
                status_code = resp.status
                headers_list = resp.getheaders()
                resp_body = resp.read()
            except urllib.error.HTTPError as e:
                status_code = e.code
                headers_list = e.headers.items()
                resp_body = e.read()

            self.send_response(status_code)
            for k, v in headers_list:
                if k.lower() in ['content-encoding', 'transfer-encoding', 'content-length', 'connection', 'keep-alive']:
                    continue
                # Se è Location redirect, adatta al proxy locale
                if k.lower() == 'location':
                    v = v.replace(REMOTE_WCAM_BASE, '/api/wcam').replace('https://www.karmaitaliana.it/wcam', '/api/wcam')
                    if not v.startswith('http') and not v.startswith('/'):
                        v = f"/api/wcam/{v}"
                self.send_header(k, v)

            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except Exception as ex:
            print(f"Errore Proxy verso {remote_url}: {ex}")
            err_msg = json.dumps({'error': 'Proxy failed', 'detail': str(ex)}).encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(err_msg)))
            self.end_headers()
            self.wfile.write(err_msg)

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    local_ip = get_local_ip()
    with ThreadedTCPServer(("0.0.0.0", PORT), VercelDevProxyHandler) as httpd:
        print("============================================================")
        print(" WebApp Karma Espositori (WCAM 2.0) - Simulatore Vercel")
        print("============================================================")
        print(" L'applicazione si connette al database LIVE di karmaitaliana.it:")
        print(f"   * Locale:       http://localhost:{PORT}")
        print(f"   * Rete Locale:  http://{local_ip}:{PORT}")
        print("============================================================")
        print(" Pronto per il deployment su VERCEL (configurato in vercel.json)")
        print("============================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer arrestato.")
