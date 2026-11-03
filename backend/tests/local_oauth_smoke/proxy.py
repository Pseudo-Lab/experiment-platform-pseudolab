import http.server,http.client,ssl
class Proxy(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self): self.forward()
 def do_POST(self): self.forward()
 def do_OPTIONS(self): self.forward()
 def do_PATCH(self): self.forward()
 def do_DELETE(self): self.forward()
 def forward(self):
  c=http.client.HTTPConnection('127.0.0.1',19001 if self.path.startswith('/api/') else 19003,timeout=15)
  h={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection']};h['Host']='localhost:19043';h['X-Forwarded-Proto']='https'
  c.request(self.command,self.path,self.rfile.read(int(self.headers.get('Content-Length',0))),h)
  r=c.getresponse();body=r.read(); self.send_response(r.status)
  for k,v in r.getheaders():
   if k.lower() not in ['connection','transfer-encoding','content-length']: self.send_header(k,v)
  self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);c.close()
s=http.server.ThreadingHTTPServer(('127.0.0.1',19043),Proxy);ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain('/tmp/oauth-security-smoke/cert.pem','/tmp/oauth-security-smoke/key.pem');s.socket=ctx.wrap_socket(s.socket,server_side=True);s.serve_forever()
