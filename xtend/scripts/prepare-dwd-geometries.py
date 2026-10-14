"""Pin official WGS84 DWD warning-cell boundaries; no user/location data.
Reads only Polygon/PolygonZ/PolygonM SHP records and DBF columns in memory.
Run explicitly when reviewing a boundary refresh; Docker builds use pinned JSON.
"""
import urllib.request,zipfile,io,struct,json,hashlib,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'vendor-inputs/dwd'
SOURCES=[('gemeinden',11),('landkreise',11),('seegebiete',4),('kueste',6)]
def dbf(raw):
 count=struct.unpack_from('<I',raw,4)[0];header,length=struct.unpack_from('<HH',raw,8);fields=[];offset=32
 while raw[offset]!=13:
  name=raw[offset:offset+11].split(b'\0')[0].decode('ascii');fields.append((name,raw[offset+16]));offset+=32
 result=[]
 for i in range(count):
  row=raw[header+i*length:header+(i+1)*length];pos=1;data={}
  for name,size in fields:data[name]=row[pos:pos+size].decode('utf-8',errors='replace').strip();pos+=size
  result.append(data)
 return result
def inside(p,r):
 x,y=p;found=False
 for a,b in zip(r,r[1:]+r[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:found=not found
 return found
def polygons(raw):
 pos=100;result=[]
 while pos<len(raw):
  _,size=struct.unpack_from('>ii',raw,pos);pos+=8;row=raw[pos:pos+size*2];pos+=size*2;kind=struct.unpack_from('<i',row)[0]
  if kind==0:result.append(None);continue
  if kind not in [5,15,25]:raise ValueError('Expected Polygon geometry')
  parts,points=struct.unpack_from('<ii',row,36);start=list(struct.unpack_from('<'+'i'*parts,row,44))+[points];coords=[list(struct.unpack_from('<dd',row,44+parts*4+i*16)) for i in range(points)]
  rings=[coords[start[i]:start[i+1]] for i in range(parts) if start[i+1]-start[i]>=4]
  areas=[abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]))) for r in rings]
  parents=[]
  for i,r in enumerate(rings):
   candidates=[j for j,p in enumerate(rings) if areas[j]>areas[i] and inside(r[0],p)]
   parents.append(min(candidates,key=lambda j:areas[j]) if candidates else None)
  def depth(i):return 0 if parents[i] is None else depth(parents[i])+1
  groups=[]
  for i,r in enumerate(rings):
   if depth(i)%2==0:groups.append([r]+[h for j,h in enumerate(rings) if parents[j]==i and depth(j)%2==1])
  result.append({'type':'MultiPolygon','coordinates':groups})
 return result
ROOT.mkdir(parents=True,exist_ok=True);boundaries={};provenance=[]
for label,version in SOURCES:
 url=f'https://www.dwd.de/DE/leistungen/opendata/help/warnungen/cap_{label}_shape_zip.zip?__blob=publicationFile&v={version}'
 raw=urllib.request.urlopen(url,timeout=30).read();z=zipfile.ZipFile(io.BytesIO(raw));prj=z.read(next(n for n in z.namelist() if n.endswith('.prj'))).decode()
 if 'WGS_1984' not in prj or 'PROJCS' in prj:raise ValueError('Expected WGS84')
 rows=dbf(z.read(next(n for n in z.namelist() if n.endswith('.dbf'))));shapes=polygons(z.read(next(n for n in z.namelist() if n.endswith('.shp'))))
 if len(rows)!=len(shapes):raise ValueError('Unaligned geometry records')
 key=next((k for k in rows[0] if 'WARNCELL' in k.upper()),None)
 if not key:raise ValueError('Missing warning-cell key: '+str(rows[0].keys()))
 for row,geometry in zip(rows,shapes):
  if geometry:boundaries[row[key]]=geometry
 provenance.append({'source':url,'sha256':hashlib.sha256(raw).hexdigest(),'cells':len(rows),'crs':'EPSG:4326'})
(ROOT/'warncells.json').write_text(json.dumps(boundaries,separators=(',',':'))+'\n')
(ROOT/'provenance.json').write_text(json.dumps({'source':'Deutscher Wetterdienst','reviewed':datetime.datetime.now(datetime.timezone.utc).isoformat(),'conversion':'prepare-dwd-geometries.py; exact rings; no simplification','files':provenance,'outputSha256':hashlib.sha256((ROOT/'warncells.json').read_bytes()).hexdigest()},indent=2)+'\n')
print(json.dumps({'cells':len(boundaries),'bytes':(ROOT/'warncells.json').stat().st_size}))
