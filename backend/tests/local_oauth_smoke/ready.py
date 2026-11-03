import ssl,time,urllib.request
ctx=ssl._create_unverified_context()
for attempt in range(30):
 try:
  with urllib.request.urlopen('https://localhost:19043/api/v1/auth/providers',context=ctx,timeout=2) as r:
   if r.status==200:break
 except Exception:time.sleep(0.25)
else:raise SystemExit('Local backend readiness failed')
