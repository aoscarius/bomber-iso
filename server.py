import http.server
import ssl

# Configs
address = ('0.0.0.0', 443)

# Create the standard HTTP server
httpd = http.server.HTTPServer(address, http.server.SimpleHTTPRequestHandler)

# Create the SSL context
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile="certs/cert.pem", keyfile="certs/key.pem")

# Wrap the server socket with SSL
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Site serverd on https://{address[0]}:{address[1]}")
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer closed.")