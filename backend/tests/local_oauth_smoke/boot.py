import json,os,sqlite3,time
from pathlib import Path
c=json.loads(Path('/tmp/oauth-security-smoke/synthetic.json').read_text())
os.environ['D1_MAIN_DATABASE_ID']='local-memory'
from app.core.auth import hash_password
from app.core.config import settings
settings.ADMIN_USERNAME=c['username']; settings.ADMIN_PASSWORD_HASH=hash_password(c['password']); settings.AUTH_SESSION_SECRET=c['session']; settings.AUTH_COOKIE_SECURE=True; settings.AUTH_COOKIE_SAMESITE='lax'; settings.BACKEND_CORS_ORIGINS=['https://localhost:19043']
settings.GOOGLE_OAUTH_CLIENT_ID='local-provider-mock';settings.GOOGLE_OAUTH_CLIENT_SECRET='synthetic-local-secret';settings.GOOGLE_OAUTH_REDIRECT_URI='https://localhost:19043/api/v1/auth/google/callback'
from app.db import d1,r2
conn=sqlite3.connect(':memory:',check_same_thread=False);conn.row_factory=sqlite3.Row
conn.executescript(Path('/tmp/oauth-security-smoke/schema.sql').read_text());conn.commit()
# Explicit synthetic administrator fixture; never infer administrator from first signup.
settings.ADMIN_ACCOUNT_ID='local-google-admin';settings.PASSWORD_LOGIN_ENABLED=False
conn.execute('INSERT INTO platform_account VALUES (?, ?, ?)', ['local-google-admin','local-admin-sub',int(time.time())])
conn.execute('INSERT INTO projects (id,name,api_key) VALUES (?, ?, ?)', ['legacy-shared','Legacy shared','local-public-legacy'])
conn.commit()
async def query(sql,params=None,database_id=None,**kwargs):
 rows=[dict(r) for r in conn.execute(sql,params or []).fetchall()];conn.commit();return rows
async def execute(sql,params=None,database_id=None):conn.execute(sql,params or []);conn.commit();return True
d1.query=query;d1.security_query=query;d1.execute=execute
r2.upload=lambda *a,**k:True
r2.delete=lambda *a,**k:True
r2.presigned_url=lambda *a,**k:'https://localhost:19043/stub'
# Test-only local provider mock. No Google request and no production credentials.
import httpx,jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from urllib.parse import parse_qs
from app.core import google_oidc
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()));jwk.update(kid='local',alg='RS256',use='sig')
def provider(request):
 if str(request.url)==google_oidc.JWKS_URL:return httpx.Response(200,json={'keys':[jwk]})
 body=parse_qs(request.content.decode());code=body['code'][0]
 is_admin=code.startswith('admin:');nonce=code.removeprefix('admin:')
 claims={'iss':'https://accounts.google.com','aud':'local-provider-mock','sub':'local-admin-sub' if is_admin else 'local-mock-account-'+nonce,'iat':int(time.time()),'exp':int(time.time())+120,'nonce':nonce}
 return httpx.Response(200,json={'id_token':jwt.encode(claims,key,algorithm='RS256',headers={'kid':'local'})})
original=httpx.AsyncClient
google_oidc.httpx.AsyncClient=lambda **kw:original(transport=httpx.MockTransport(provider),**kw)
from app.main import app
import uvicorn
uvicorn.run(app,host='127.0.0.1',port=19001,access_log=False,log_level='error')
