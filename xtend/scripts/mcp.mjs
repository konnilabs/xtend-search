import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const framework=process.env.XTEND_ROOT || '/home/konni/Downloads/xtend-main/xtend';
const {createXtendMcpClient}=await import(pathToFileURL(path.join(framework,'products/xtend-mcp/src/client.mjs')));
const handle=await createXtendMcpClient({workspaceRoots:[root],cwd:root});
const [mode,name,raw='{}']=process.argv.slice(2);
const input=JSON.parse(raw); const start=performance.now();
const id=new Date().toISOString().replaceAll(':','-');
const directory=path.join(root,'evidence/mcp'); fs.mkdirSync(directory,{recursive:true});
try {
 let result;
 if(mode==='list') result=await handle.client.listTools();
 else if(mode==='read') result=await handle.client.readResource({uri:name});
 else if(mode==='call') result=await handle.client.callTool({name,arguments:input});
 else throw new Error('Usage: mcp.mjs list | read URI | call TOOL JSON');
 const filename=`${id}-${(name || mode).replace(/[^a-zA-Z0-9_-]/g,'_')}.json`;
 fs.writeFileSync(path.join(directory,filename),JSON.stringify(result,null,2)+'\n');
 fs.appendFileSync(path.join(directory,'interactions.jsonl'),JSON.stringify({id,timestamp:new Date().toISOString(),transport:'MCP stdio',mode,tool:name,input,inputHash:createHash('sha256').update(raw).digest('hex'),durationMs:performance.now()-start,transportStatus:result.isError?'error':'success',resultStatus:result.isError || result.structuredContent?.data?.ok===false?'error':'success',provenance:result.structuredContent?.provenance,evidencePath:filename})+'\n');
 console.log(JSON.stringify(result));
 if(result.isError || result.structuredContent?.data?.ok===false)process.exitCode=1;
} finally {await handle.close();}
