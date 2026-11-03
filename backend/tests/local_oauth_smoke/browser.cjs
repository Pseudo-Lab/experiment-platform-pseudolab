const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs=require('fs');const c=JSON.parse(fs.readFileSync('/tmp/oauth-security-smoke/synthetic.json'));const results=[];
function check(name,ok){results.push({name,passed:!!ok});if(!ok)throw Error(name)}
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));page.on('request',r=>{const u=new URL(r.url());if(r.isNavigationRequest())console.log('NAV',u.origin,u.pathname)});page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))console.log('AUTH',u.pathname,r.status())});
 const handleRoute=async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/api/v1/auth/google/start'){
   const response=await route.fetch({maxRedirects:0});const authorize=new URL(response.headers()['location']);
   check('Google authorization uses code + PKCE S256',authorize.hostname==='accounts.google.com'&&authorize.searchParams.get('response_type')==='code'&&authorize.searchParams.get('code_challenge_method')==='S256');
   const target=new URL('https://localhost:19043/api/v1/auth/google/callback');
   target.searchParams.set('state',authorize.searchParams.get('state'));target.searchParams.set('code',authorize.searchParams.get('nonce'));
   const headers={...response.headers(),'content-type':'text/html'};delete headers.location;delete headers['content-length'];
   return route.fulfill({status:200,headers,body:`<meta http-equiv="refresh" content="0;url=${target.href.replaceAll('&','&amp;')}">`});
  }
  return u.hostname==='localhost'?route.continue():route.abort();
 };
 await context.route('**/*',handleRoute);
 const req=context.request,base='https://localhost:19043/api/v1';
 await page.goto('https://localhost:19043/api-key');await page.waitForURL('**/login');
 check('anonymous projects denied',(await req.get(base+'/projects/')).status()===401);
 await page.getByRole('link',{name:/^(SDK 가이드|SDK guide)$/}).click();await page.waitForURL('**/docs/sdk');
 check('public SDK guide preserves login return route',true);
 await page.getByRole('link',{name:/^(로그인|Sign in)$/}).click();await page.waitForURL('**/login');
 await page.getByRole('button',{name:/Google/}).click();await page.waitForURL('**/api-key');
 check('OAuth restores original SDK integration route',true);
 check('local mock OIDC succeeds in real browser',true);
 const cookies=await context.cookies();const session=cookies.find(x=>x.name==='experiment_platform_session');
 check('Google session Secure HttpOnly SameSite=Lax',session&&session.secure&&session.httpOnly&&session.sameSite==='Lax');
 check('OAuth attempt cookie consumed',!cookies.some(x=>x.name==='experiment_platform_oauth'));
 check('member role restored',(await (await req.get(base+'/auth/me')).json()).user.is_admin===false);
 check('member has no initial projects',(await (await req.get(base+'/projects/')).json()).length===0);
 check('member cannot query global segments',(await req.get(base+'/segments/')).status()===403);
 check('member cannot query global dashboard',(await req.get(base+'/dashboard/summary')).status()===403);
 check('member cannot query global analytics',(await req.get(base+'/analytics/events')).status()===403);
 let r=await req.post(base+'/projects/',{data:{id:'browser-project',name:'Browser project'}});check('member creates own project',r.status()===201);
 const keyResponse=await req.get(base+'/projects/browser-project/api-key');const sdkKey=(await keyResponse.json()).api_key;
 check('key read no-store',keyResponse.headers()['cache-control']==='no-store');
 await page.evaluate(()=>localStorage.setItem('currentProjectId','browser-project'));
 await page.goto('https://localhost:19043/api-key');await page.getByRole('button',{name:/^(보기|Reveal)$/}).waitFor();
 check('SDK key masked initially',!(await page.locator('body').innerText()).includes(sdkKey));
 await page.getByRole('button',{name:/^(보기|Reveal)$/}).click();check('SDK key explicit reveal',(await page.locator('body').innerText()).includes(sdkKey));
 await page.reload();await page.getByRole('button',{name:/^(보기|Reveal)$/}).waitFor();check('member session survives reload',new URL(page.url()).pathname==='/api-key');
 check('member sidebar hides internal bugs',await page.getByRole('button',{name:'버그 & 기능 요청'}).count()===0);
 r=await req.post(base+'/feature-flags/',{data:{flag_key:'browser-flag',project_id:'browser-project',enabled:true,rollout_pct:100}});check('member creates scoped flag',r.status()===201);
 r=await req.post(base+'/decide',{headers:{'X-API-Key':sdkKey},data:{key:'browser-flag',user_id:'visitor'}});check('SDK decide own flag',r.status()===200&&(await r.json()).variant==='treatment');
 r=await req.post(base+'/capture',{headers:{'X-API-Key':sdkKey},data:{event_name:'clicked',user_id:'visitor'}});check('SDK captures scoped event',r.status()===202);
 const second=await browser.newContext({ignoreHTTPSErrors:true});await second.route('**/*',handleRoute);
 const secondPage=await second.newPage();await secondPage.goto('https://localhost:19043/login');
 await secondPage.getByRole('button',{name:/Google/}).click();await secondPage.waitForURL('**/projects');
 await second.request.post(base+'/projects/',{data:{id:'other-project',name:'Other project'}});
 const otherKey=(await (await second.request.get(base+'/projects/other-project/api-key')).json()).api_key;
 page.on('dialog',dialog=>dialog.accept());
 r=await req.post(base+'/feature-flags/browser-flag/rules',{data:{variant:'treatment',rollout_pct:50}});check('member creates treatment rule',r.status()===201);
 for(const model of ['legacy','sdk_v1']){
  const id='browser-'+model.replace('_','-');
  r=await req.post(base+'/experiments/',{data:{id,name:'Browser '+model,project_id:'browser-project',flag_key:'browser-flag',primary_metric:'purchase',event_model:model}});
  check(model+' member creates A/B experiment',r.status()===201);
  await page.goto('https://localhost:19043/experiments/'+id);
  await page.getByRole('button',{name:/^(시작|Start)$/}).waitFor();
  check(model+' member placement controls hidden',await page.getByRole('button',{name:/Placement|placement/}).count()===0);
  await page.getByRole('button',{name:/^(시작|Start)$/}).click();
  await page.waitForTimeout(300);
  check(model+' starts through real UI',(await (await req.get(base+'/experiments/'+id)).json()).status==='running');
  r=await req.post(base+'/decide',{headers:{'X-API-Key':sdkKey},data:{key:'browser-flag',user_id:'visitor',experiment_id:id,...(model==='sdk_v1'?{event_model:model}:{})}});
  check(model+' SDK assignment succeeds',r.status()===200);const decision=await r.json();
  let path,payload,action;
  if(model==='sdk_v1'){
   const context={...decision.tracking_context,impression_id:'browser-view',session_id:'browser-tab'};
   path='/capture';payload={user_id:'visitor',event_name:'exp_exposure',event_id:'browser-view',experiment_id:id,variant:context.variant,session_id:'browser-tab',tracking_context:context,sdk_event_type:'exposure'};
   action={...payload,event_name:'purchase',event_id:'browser-action',sdk_event_type:'conversion'};
  }else{
   path='/events';payload={type:'impression',key:'browser-flag',experiment_id:id,variant:decision.variant,user_id:'visitor'};action={...payload,type:'conversion'};
  }
  check(model+' foreign SDK key rejected',(await second.request.post(base+path,{headers:{'X-API-Key':otherKey},data:payload})).status()===404);
  check(model+' exposure accepted',(await req.post(base+path,{headers:{'X-API-Key':sdkKey},data:payload})).status()===202);
  check(model+' conversion accepted',(await req.post(base+path,{headers:{'X-API-Key':sdkKey},data:action})).status()===202);
  const analytics=await (await req.get(base+'/experiments/'+id+'/analytics')).json();
  check(model+' events attributed to launched experiment',analytics.impressions.total===1&&analytics.conversions.total===1);
  check(model+' other account analytics denied',(await second.request.get(base+'/experiments/'+id+'/analytics')).status()===404);
 }
 check('other account project key denied',(await second.request.get(base+'/projects/browser-project/api-key')).status()===404);
 await second.close();
 r=await req.post(base+'/projects/browser-project/server-key');check('036 credential issued no-store',r.status()===200&&r.headers()['cache-control']==='no-store');
 const server=(await r.json()).server_key;
 check('public key Bearer denied',(await req.post(base+'/access/decide',{headers:{Authorization:'Bearer '+sdkKey},data:{}})).status()===401);
 check('active server credential authenticated',(await req.post(base+'/access/decide',{headers:{Authorization:'Bearer '+server},data:{}})).status()===422);
 check('server credential cannot be SDK key',(await req.post(base+'/capture',{headers:{'X-API-Key':server},data:{}})).status()===401);
 check('credential revocation succeeds',(await req.delete(base+'/projects/browser-project/server-key')).status()===204);
 check('revoked credential rejected',(await req.post(base+'/access/decide',{headers:{Authorization:'Bearer '+server},data:{}})).status()===401);
 check('project references block deletion',(await req.delete(base+'/projects/browser-project')).status()===409);
 await page.getByRole('button',{name:/^(로그아웃|Logout)$/}).click();await page.waitForURL('**/login');
 check('logout revokes copied session',(await req.get(base+'/projects/',{headers:{Cookie:'experiment_platform_session='+session.value}})).status()===401);
 check('public SDK key cannot manage',(await req.get(base+'/projects/',{headers:{'X-API-Key':sdkKey}})).status()===401);
 await page.locator('input[autocomplete=username]').fill(c.username);await page.locator('input[type=password]').fill(c.password);await page.locator('button[type=submit]').click();await page.waitForURL(u=>!u.pathname.includes('login'));
 check('existing administrator UI login preserved',(await (await req.get(base+'/auth/me')).json()).user.is_admin===true);
 check('admin can access member project',(await req.get(base+'/projects/browser-project')).status()===200);
 check('untrusted Origin blocked',(await req.post(base+'/admin/srm-check',{headers:{Origin:'https://evil.invalid'}})).status()===403);
 await page.screenshot({path:'/tmp/oauth-security-smoke/admin.png'});
 fs.writeFileSync('/tmp/oauth-security-smoke/browser-results.json',JSON.stringify({provider:'LOCAL MOCK; not real Google',browser:browser.version(),results},null,2));console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.passed).length}));
 }catch(e){fs.writeFileSync('/tmp/oauth-security-smoke/browser-results.json',JSON.stringify({provider:'LOCAL MOCK; not real Google',results,failure:e.message},null,2));console.log('Browser test failed; see sanitized result');process.exitCode=1}finally{if(browser)await browser.close()}})();
