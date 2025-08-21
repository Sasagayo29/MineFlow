import http.server
import socketserver
import webbrowser
import threading
import os

PORT = 8000

# Abre o navegador automaticamente
def abrir_navegador():
    webbrowser.open(f"http://localhost:{PORT}")

# Define o diretório como raiz do projeto
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Inicia o servidor
handler = http.server.SimpleHTTPRequestHandler
servidor = socketserver.TCPServer(("", PORT), handler)

# Abre o navegador em outra thread
threading.Timer(1.0, abrir_navegador).start()

print(f"Servidor rodando em http://localhost:{PORT}")
servidor.serve_forever()
