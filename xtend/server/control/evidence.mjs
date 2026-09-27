import fs from 'node:fs/promises';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
const WEEK=7*86400000;
// Separate volume, bounded lifetime. No evidence contents enter the control DB.
export class EvidenceStore {
 constructor(directory,key,{now=Date.now}={}){this.directory=directory;this.key=createHash('sha256').update(key).update('feedback-evidence-v1').digest();this.now=now;}
 async initialize(){await fs.mkdir(this.directory,{recursive:true,mode:0o700});await this.rotate();}
 file(id){if(!/^[a-f0-9]{48}$/.test(id))throw new Error('evidence_id');return path.join(this.directory,id+'.json');}
 async put(url){const files=await fs.readdir(this.directory);if(files.length>=10000)throw new Error('evidence_capacity');const id=randomBytes(24).toString('hex'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);const data=Buffer.concat([cipher.update(url,'utf8'),cipher.final()]);await fs.writeFile(this.file(id),JSON.stringify({expires:this.now()+WEEK,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600,flag:'wx'});return id;}
 async get(id){try{const value=JSON.parse(await fs.readFile(this.file(id),'utf8'));if(value.expires<=this.now()){await this.remove(id);return null;}const cipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(value.iv,'base64'));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(value.data,'base64')),cipher.final()]).toString('utf8');}catch{return null;}}
 async remove(id){await fs.rm(this.file(id),{force:true});}
 async rotate(){for(const name of await fs.readdir(this.directory)){if(!/^[a-f0-9]{48}\.json$/.test(name))continue;try{const value=JSON.parse(await fs.readFile(path.join(this.directory,name),'utf8'));if(!Number.isFinite(value.expires)||value.expires<=this.now())await fs.rm(path.join(this.directory,name),{force:true});}catch{await fs.rm(path.join(this.directory,name),{force:true});}}}
}
