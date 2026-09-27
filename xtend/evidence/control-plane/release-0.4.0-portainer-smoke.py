import os, json, subprocess, time, hashlib, urllib.request, urllib.error, urllib.parse
from pathlib import Path

root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
env=dict(os.environ,XTEND_SEARCH_IMAGE='xtend-search:0.4.0',XTEND_BACKEND_IMAGE='xtend-search-searxng:0.4.0',XTEND_PORT='8097',PUBLIC_BASE_URL='http://localhost:8097',SEARXNG_TOKEN='fixture-0.4.0-backend-only',NEXTCLOUD_CLIENT_ID='fixture-portainer',NEXTCLOUD_CLIENT_SECRET='fixture-$-#-quote-"-only',XTEND_ADMIN_ROLES='{"fixture-user":"administrator"}',XTEND_CONTROL_VOLUME='xtend040-smoke-control',XTEND_BACKEND_VOLUME='xtend040-smoke-backend',XTEND_EVIDENCE_VOLUME='xtend040-smoke-evidence',XTEND_PROBES='0')
compose=['docker','compose','-p','xtend040-smoke','-f',str(root/'compose.portainer.yml')]
def run(args,**kw):return subprocess.check_output(args,env=env,cwd=root,text=True,**kw).strip()
def dc(*args):return run(compose+list(args))
def inspect(cid):return json.loads(run(['docker','inspect',cid]))[0]
def ready():
 for _ in range(45):
  try:
   with urllib.request.urlopen('http://localhost:8097/health/ready',timeout=2) as r:
    health=json.load(r)
    if health.get('ok'):return health
  except (OSError,ValueError):pass
  time.sleep(1)
 raise AssertionError('Stack did not become ready')
def stamp(cid):
 code="const fs=require('fs'),c=require('crypto'),{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/var/lib/xtend-search/control/control-plane.sqlite',{readOnly:true});console.log(JSON.stringify({key:c.createHash('sha256').update(fs.readFileSync('/var/lib/xtend-search/resume/resume-public.json')).digest('hex'),meta:db.prepare('SELECT * FROM metadata').all(),policies:db.prepare('SELECT count(*) n FROM policies').get().n}));db.close();"
 return json.loads(run(['docker','exec',cid,'node','-e',code]))
report={'version':'0.4.0','project':'xtend040-smoke','checks':[]}
try:
 dc('config','--quiet')
 for field in ['SEARXNG_TOKEN','NEXTCLOUD_CLIENT_ID','NEXTCLOUD_CLIENT_SECRET','XTEND_ADMIN_ROLES']:
  bad=dict(env);bad[field]='';r=subprocess.run(compose+['config','--quiet'],env=bad,cwd=root,capture_output=True);assert r.returncode!=0,field
 report['checks'].append('Compose accepts filled variables and rejects empty required variables.')
 dc('up','-d','--no-build','--wait','--wait-timeout','150')
 health=ready();assert health['version']=='0.4.0' and health['retrieval']=='compatible'
 search=dc('ps','-q','search');backend=dc('ps','-q','searxng');s=inspect(search);b=inspect(backend)
 values=dict(v.split('=',1) for v in s['Config']['Env']);assert values['NEXTCLOUD_CLIENT_SECRET']==env['NEXTCLOUD_CLIENT_SECRET'];assert json.loads(values['XTEND_ADMIN_ROLES'])=={'fixture-user':'administrator'}
 assert s['NetworkSettings']['Ports']['8080/tcp']==[{'HostIp':'127.0.0.1','HostPort':'8097'}];assert not any(b['NetworkSettings']['Ports'].values());assert not any(v.startswith('NEXTCLOUD_') for v in b['Config']['Env'])
 assert s['State']['Health']['Status']=='healthy' and b['State']['Health']['Status']=='healthy'
 assert all(m['Type']=='volume' for m in s['Mounts']+b['Mounts'])
 report['checks'].append('Frontend 0.4.0 and backend 0.4.0 healthy; literal punctuation and roles preserved; only loopback frontend port published; storage uses named volumes.')
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):return None
 try:urllib.request.build_opener(NoRedirect).open('http://localhost:8097/admin/login')
 except urllib.error.HTTPError as r:
  assert r.code in (302,303);url=urllib.parse.urlparse(r.headers['Location']);params=urllib.parse.parse_qs(url.query);assert url.hostname=='vm.ccs-networks.de';assert params['redirect_uri']==['http://localhost:8097/admin/oauth/callback'];assert params['client_id']==['fixture-portainer']
 else:raise AssertionError('OAuth redirect absent')
 report['checks'].append('Nextcloud redirect is configured correctly, verified without contacting Nextcloud.')
 before=stamp(search);assert before['policies']==0
 dc('up','-d','--no-deps','--no-build','--force-recreate','--wait','--wait-timeout','90','search');ready();after=stamp(dc('ps','-q','search'));assert before==after
 report['checks'].append('Recreation retains public signing-key fingerprint and database; no live provider approval or search performed.')
 report.update(ok=True,health=health,imageIds={'search':s['Image'],'searxng':b['Image']},composeSha256=hashlib.sha256((root/'compose.portainer.yml').read_bytes()).hexdigest())
finally:
 dc('down','--volumes','--remove-orphans');report['testResourcesRemoved']=True
 (out/'release-0.4.0-portainer-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
