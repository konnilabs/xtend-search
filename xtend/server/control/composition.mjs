import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {EvidenceStore} from './evidence.mjs';
import {QualityService} from './quality.mjs';
import {FaviconService} from './favicons.mjs';
import {Store} from './store.mjs';
import {SearxAdapter} from './adapter.mjs';
import {ControlPlane} from './plane.mjs';
import {MediaProxy} from './media.mjs';
import {SearchExecutor} from './executor.mjs';
import {AdminService} from './admin.mjs';
import {NextcloudAuth,secret} from './auth.mjs';
let current;
export async function initialize(){
 if(current)return current;
 if(Number(process.env.WEB_CONCURRENCY||1)!==1||Number(process.env.XTEND_REPLICAS||1)!==1)throw new Error('Single owner required; shared budget storage is not implemented.');
 const directory=process.env.XTEND_DATA_DIR||path.resolve('xtend/.control');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const keyFile=path.join(directory,'signing-key');if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(48),{mode:0o600});const key=fs.readFileSync(keyFile);
 const store=new Store(directory),adapter=new SearxAdapter({baseUrl:process.env.SEARXNG_BASE_URL||'http://searxng:8082/',token:secret('SEARXNG_TOKEN')}),plane=new ControlPlane({store,adapter,probeEnabled:process.env.XTEND_PROBES==='1'});
 const evidence=new EvidenceStore(process.env.XTEND_EVIDENCE_DIR||path.resolve('xtend/.evidence'),key);await evidence.initialize();
 const quality=new QualityService(plane,evidence),favicons=new FaviconService(adapter,key,{resolver:process.env.XTEND_FAVICON_RESOLVER||'duckduckgo'});
 const media=new MediaProxy(key),search=new SearchExecutor(plane,media,key,{quality,favicons}),admin=new AdminService(plane),auth=new NextcloudAuth();
 current={store,adapter,plane,media,search,admin,auth,quality,evidence,favicons};await plane.initialize();return current;
}
export function application(){if(!current)throw new Error('Host lifecycle has not initialized services.');return current;}
