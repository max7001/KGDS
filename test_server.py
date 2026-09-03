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

        if path.startswith('/api/wcam') or path.startswith('/api/karma-search'):
            return self.proxy_to_karma(parsed, 'POST')

        return super().do_POST()

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
