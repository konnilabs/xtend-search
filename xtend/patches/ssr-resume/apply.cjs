const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
module.exports=function applySsrResumePatch(){
 const manifest=require('./manifest.json'),sdk=path.resolve(__dirname,'../../node_modules/@ccslabs/xtend');
 if(JSON.parse(fs.readFileSync(path.join(sdk,'package.json'))).version!==manifest.version)throw new Error('SSR patch requires reviewed XTend '+manifest.version);
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const pending=manifest.files.map(file=>{
  const target=path.join(sdk,file.path),replacement=fs.readFileSync(path.join(__dirname,'files',file.path)),current=hash(fs.readFileSync(target));
  if(hash(replacement)!==file.after||![file.before,file.after].includes(current))throw new Error('Unreviewed XTend SSR source: '+file.path);
  return {target,replacement,current,file};
 });
 for(const p of pending)if(p.current!==p.file.after)fs.writeFileSync(p.target,p.replacement);
 return {version:manifest.version,upstreamBase:manifest.upstreamBase,files:pending.map(p=>({path:p.file.path,sha256:p.file.after}))};
};
