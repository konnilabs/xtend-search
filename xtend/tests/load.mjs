import fs from 'node:fs';
const rows=[];
for(const target of [{name:'upstream',base:'http://127.0.0.1:8094'},{name:'xtend',base:'http://127.0.0.1:8080'}])for(const concurrency of [1,5,20]){
 let next=0;const samples=[],start=performance.now();
 await Promise.all(Array.from({length:concurrency},async()=>{while(next<30){const index=next++;const t=performance.now();const r=await fetch(target.base+'/search?q=benchmark50&language=all&safesearch=1');await r.arrayBuffer();samples.push({index,status:r.status,ms:performance.now()-t});}}));
 const duration=performance.now()-start;const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);const result={target:target.name,concurrency,requests:30,duration,requestsPerSecond:30000/duration,p95:sorted[Math.ceil(sorted.length*.95)-1],errors:samples.filter(r=>r.status!==200).length,samples};rows.push(result);console.log(JSON.stringify({...result,samples:undefined}));
}
fs.writeFileSync('evidence/tests/load.json',JSON.stringify({timestamp:new Date().toISOString(),mode:'local-processes',rows},null,2));
