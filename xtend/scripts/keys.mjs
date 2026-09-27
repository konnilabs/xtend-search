import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,createPublicKey,createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.resolve(process.env.XTEND_SECRET_DIR || path.join(root,'.secrets'));
fs.mkdirSync(directory,{recursive:true,mode:0o700});
const file=path.join(directory,'resume-private.pem');
if(!fs.existsSync(file)){
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 fs.writeFileSync(file,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
}
const publicKey=createPublicKey(fs.readFileSync(file)).export({format:'jwk'});
publicKey.kid=createHash('sha256').update(JSON.stringify(publicKey)).digest('hex').slice(0,20);
fs.writeFileSync(path.join(directory,'resume-public.json'),JSON.stringify(publicKey,null,2)+'\n',{mode:0o600});
console.log('Resume-Schlüsselpaar bereit; der private Schlüssel bleibt außerhalb des Builds.');
