import {randomInt} from 'node:crypto';
import {DEFAULT_MOTD,motdDay} from './motd.mjs';
import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(workerData.file);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1500; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, mode TEXT NOT NULL);
 INSERT OR IGNORE INTO metadata VALUES (1,0,'conservative');
 CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS guards (id TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, time INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, revision INTEGER NOT NULL, requestKey TEXT UNIQUE NOT NULL, digest TEXT);
 CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, time INTEGER NOT NULL, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS aggregates (minute INTEGER NOT NULL, engine TEXT NOT NULL, origin TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(minute,engine,origin));
 CREATE TABLE IF NOT EXISTS quality_rules (engine TEXT NOT NULL, capability TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(engine,capability));
 CREATE TABLE IF NOT EXISTS quality_pauses (engine TEXT NOT NULL, capability TEXT NOT NULL, until INTEGER NOT NULL, lastAutoAt INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(engine,capability));
 CREATE TABLE IF NOT EXISTS quality_reports (report TEXT NOT NULL, engine TEXT NOT NULL, capability TEXT NOT NULL, reason TEXT NOT NULL, time INTEGER NOT NULL, evidence TEXT, PRIMARY KEY(report,engine,capability));
 CREATE INDEX IF NOT EXISTS quality_reports_time ON quality_reports(time);
 CREATE INDEX IF NOT EXISTS quality_reports_scope ON quality_reports(engine,capability,time);
 CREATE TABLE IF NOT EXISTS quality_proposals (id TEXT PRIMARY KEY, engine TEXT NOT NULL, capability TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS quality_proposals_scope ON quality_proposals(engine,capability,status);
 CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS weather_policy (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS weather_budget (minute INTEGER PRIMARY KEY, units INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS feedback_batches (id TEXT PRIMARY KEY, digest TEXT NOT NULL, time INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS feedback_proofs (id TEXT PRIMARY KEY, time INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS quality_batch_evidence (batch TEXT NOT NULL, engine TEXT NOT NULL, capability TEXT NOT NULL, evidence TEXT NOT NULL, reason TEXT NOT NULL, time INTEGER NOT NULL);
 PRAGMA user_version=4;`);
if(!db.prepare('PRAGMA table_info(audit)').all().some(c=>c.name==='digest'))db.exec('ALTER TABLE audit ADD COLUMN digest TEXT');
const readQuality=()=>({rules:db.prepare('SELECT * FROM quality_rules').all().map(r=>({...r,value:JSON.parse(r.value)})),pauses:db.prepare('SELECT * FROM quality_pauses').all(),proposals:db.prepare('SELECT * FROM quality_proposals ORDER BY created DESC LIMIT 500').all(),counts:db.prepare(`SELECT engine,capability,reason,count(*) AS total,sum(CASE WHEN evidence IS NOT NULL AND time>strftime('%s','now')*1000-604800000 THEN 1 ELSE 0 END)+(SELECT count(*) FROM quality_batch_evidence b WHERE b.engine=quality_reports.engine AND b.capability=quality_reports.capability AND b.reason=quality_reports.reason AND b.time>strftime('%s','now')*1000-604800000) AS evidenceCount,max(time) AS latest FROM quality_reports WHERE time>? GROUP BY engine,capability,reason`).all(Date.now()-30*86400000)});
function qualityRotate(time){db.prepare('DELETE FROM feedback_batches WHERE time<?').run(time-30*86400000);db.prepare('DELETE FROM feedback_proofs WHERE time<?').run(time-30*86400000);db.prepare('DELETE FROM quality_batch_evidence WHERE time<?').run(time-7*86400000);db.prepare('DELETE FROM quality_reports WHERE time<?').run(time-30*86400000);db.prepare('UPDATE quality_reports SET evidence=NULL WHERE time<?').run(time-7*86400000);db.prepare("UPDATE quality_proposals SET status='expired',updated=? WHERE status='pending' AND created<?").run(time,time-30*86400000);db.prepare("DELETE FROM quality_proposals WHERE status!='pending' AND updated<?").run(time-180*86400000);}
const readWeather=()=>{const row=db.prepare('SELECT value FROM weather_policy WHERE id=1').get();return row?JSON.parse(row.value):{enabled:false,paused:false,alerts:true,minute:540,hour:4500,day:9000,month:270000};};
function weatherBudget(time){const d=new Date(time),day=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()),month=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);const rows=db.prepare('SELECT minute,units FROM weather_budget WHERE minute>=?').all(Math.min(month,Math.floor((time-3600000)/60000)*60000));const sum=since=>rows.filter(r=>r.minute>=Math.floor(since/60000)*60000).reduce((n,r)=>n+r.units,0);return {minute:sum(time-60000),hour:sum(time-3600000),day:sum(day),month:sum(month)};}
const readMotd=()=>{const row=db.prepare('SELECT value FROM site_content WHERE id=1').get();return row?JSON.parse(row.value):{messages:[DEFAULT_MOTD],message:DEFAULT_MOTD,day:'',manual:false};};
const writeMotd=value=>{db.prepare('INSERT INTO site_content VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(value));return value;};
const selectMotd=(value,day)=>{
 const alternatives=value.messages.filter(message=>message!==value.message);
 const candidates=alternatives.length?alternatives:value.messages;
 return {...value,day,manual:false,message:candidates[randomInt(candidates.length)]};
};
const read=()=>({meta:db.prepare('SELECT * FROM metadata WHERE id=1').get(),policies:db.prepare('SELECT * FROM policies').all(),guards:db.prepare('SELECT * FROM guards').all(),events:db.prepare('SELECT seq,value FROM events ORDER BY seq DESC LIMIT 100').all().reverse(),audit:db.prepare('SELECT seq,time,actor,action,target,reason,revision FROM audit ORDER BY seq DESC LIMIT 100').all(),aggregates:db.prepare('SELECT minute, sum(total) AS total, sum(errors) AS errors, sum(duration) AS duration FROM aggregates GROUP BY minute ORDER BY minute DESC LIMIT 60').all().reverse(),quality:readQuality(),motd:readMotd(),weather:readWeather()});
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
function rotate(){const t=Date.now();db.prepare('DELETE FROM events WHERE time < ? OR seq <= (SELECT COALESCE(MAX(seq),0)-10000 FROM events)').run(t-48*3600000);db.prepare('DELETE FROM aggregates WHERE minute < ? OR rowid IN (SELECT rowid FROM aggregates ORDER BY minute DESC LIMIT -1 OFFSET 500000)').run(t-30*86400000);db.prepare('DELETE FROM audit WHERE time < ?').run(t-180*86400000);db.exec('PRAGMA wal_checkpoint(PASSIVE)');}
parentPort.on('message',({id,op,data})=>{
 try{
  let value;
  if(op==='load')value=read();
  else if(op==='weatherBudget')value=weatherBudget(data.time);
  else if(op==='weatherReserve')value=transaction(()=>{const totals=weatherBudget(data.time),policy=readWeather();if(!policy.enabled||policy.paused)return {ok:false,reason:'disabled',totals};if(Object.keys(totals).some(k=>totals[k]+data.units>policy[k]))return {ok:false,reason:'budget',totals};const minute=Math.floor(data.time/60000)*60000;db.prepare('INSERT INTO weather_budget VALUES (?,?) ON CONFLICT(minute) DO UPDATE SET units=units+excluded.units').run(minute,data.units);db.prepare('DELETE FROM weather_budget WHERE minute<?').run(Date.UTC(new Date(data.time).getUTCFullYear(),new Date(data.time).getUTCMonth()-1,1));return {ok:true,totals:weatherBudget(data.time)};});
  else if(op==='feedbackBatch')value=transaction(()=>{qualityRotate(data.time);const old=db.prepare('SELECT digest FROM feedback_batches WHERE id=?').get(data.id);if(old){if(old.digest!==data.digest)throw Error('conflict');return {duplicate:true,inserted:0,quality:readQuality()};}if(data.proofs.some(id=>db.prepare('SELECT id FROM feedback_proofs WHERE id=?').get(id)||db.prepare('SELECT report FROM quality_reports WHERE report=?').get(id)))throw Error('proof_used');if(db.prepare('SELECT count(*) n FROM quality_reports').get().n>=200000)throw Error('capacity');db.prepare('INSERT INTO feedback_batches VALUES (?,?,?)').run(data.id,data.digest,data.time);for(const id of data.proofs)db.prepare('INSERT INTO feedback_proofs VALUES (?,?)').run(id,data.time);for(const row of data.votes)db.prepare('INSERT INTO quality_reports VALUES (?,?,?,?,?,NULL)').run(data.id,row.engine,row.capability,data.reason,data.time);for(const row of data.evidence)db.prepare('INSERT INTO quality_batch_evidence VALUES (?,?,?,?,?,?)').run(data.id,row.engine,row.capability,row.evidence,data.reason,data.time);for(const p of data.proposals)if(!db.prepare("SELECT id FROM quality_proposals WHERE engine=? AND capability=? AND kind=? AND status='pending'").get(p.engine,p.capability,p.kind))db.prepare('INSERT INTO quality_proposals VALUES (?,?,?,?,?,?,?)').run(p.id,p.engine,p.capability,p.kind,p.status,p.created,p.updated);return {inserted:data.votes.length,duplicate:false,quality:readQuality()};});
  else if(op==='feedbackBatchCheck'){const row=db.prepare('SELECT digest FROM feedback_batches WHERE id=?').get(data.id);if(row&&row.digest!==data.digest)throw Error('conflict');value=!!row;}
  else if(op==='motdDay')value=transaction(()=>{const current=readMotd();return current.day===data.day?current:writeMotd(selectMotd(current,data.day));});
  else if(op==='feedback')value=transaction(()=>{
   qualityRotate(data.time);
   if(db.prepare('SELECT id FROM feedback_proofs WHERE id=?').get(data.report))return {inserted:0,quality:readQuality()};
   if(db.prepare('SELECT count(*) AS n FROM quality_reports').get().n>=200000)throw new Error('capacity');
   let inserted=0;for(const engine of data.engines)inserted+=Number(db.prepare('INSERT OR IGNORE INTO quality_reports VALUES (?,?,?,?,?,?)').run(data.report,engine,data.capability,data.reason,data.time,data.evidence).changes);
   if(inserted)for(const p of data.proposals)if(!db.prepare("SELECT id FROM quality_proposals WHERE engine=? AND capability=? AND kind=? AND status='pending'").get(p.engine,p.capability,p.kind))db.prepare('INSERT INTO quality_proposals VALUES (?,?,?,?,?,?,?)').run(p.id,p.engine,p.capability,p.kind,p.status,p.created,p.updated);
   return {inserted,quality:readQuality()};
  });
  else if(op==='qualityEvidence')value=db.prepare('SELECT evidence,reason,time FROM quality_reports WHERE engine=? AND capability=? AND time>? AND evidence IS NOT NULL UNION ALL SELECT evidence,reason,time FROM quality_batch_evidence WHERE engine=? AND capability=? AND time>? ORDER BY time DESC LIMIT 20').all(data.engine,data.capability,data.since,data.engine,data.capability,data.since);
  else if(op==='qualityRotate'){qualityRotate(data.time);value=readQuality();}
  else if(op==='mutationCheck'){const p=db.prepare('SELECT digest FROM audit WHERE requestKey=?').get(data.requestKey);if(p&&p.digest!==data.digest)throw new Error('conflict');value=!!p;}
  else if(op==='mutation')value=transaction(()=>{
   const previous=db.prepare('SELECT revision,digest FROM audit WHERE requestKey=?').get(data.requestKey);
   if(previous){if(previous.digest!==data.digest)throw new Error('conflict');return {duplicate:true,...read()};}
   if(db.prepare('SELECT revision FROM metadata WHERE id=1').get().revision!==data.revision)throw new Error('conflict');
   if(db.prepare('SELECT count(*) AS n FROM audit').get().n>=100000)throw new Error('audit_capacity');
   const revision=data.revision+1;
   if(data.weather)db.prepare('INSERT INTO weather_policy VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(data.weather));
   for(const [key,guard]of data.recover||[])db.prepare('INSERT INTO guards VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(guard));
   if(data.motd){const day=motdDay(Date.now());let current=readMotd();if(current.day!==day)current=selectMotd(current,day);
    const spec=data.motd;
    if(spec.operation==='list'){current={...current,messages:spec.messages};if(!current.manual&&!current.messages.includes(current.message))current=selectMotd(current,day);}
    if(spec.operation==='override')current={...current,day,manual:true,message:spec.message};
    if(spec.operation==='rotate')current=selectMotd(current,day);
    writeMotd(current);
   }
   if(data.policy)db.prepare('INSERT INTO policies VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(data.target,JSON.stringify(data.policy));
   if(data.qualityRule){const r=data.qualityRule;db.prepare('INSERT INTO quality_rules VALUES (?,?,?) ON CONFLICT(engine,capability) DO UPDATE SET value=excluded.value').run(r.engine,r.capability,JSON.stringify(r.value));}
   if(data.qualityPause){const p=data.qualityPause;db.prepare('INSERT INTO quality_pauses VALUES (?,?,?,?) ON CONFLICT(engine,capability) DO UPDATE SET until=excluded.until,lastAutoAt=excluded.lastAutoAt').run(p.engine,p.capability,p.until,p.lastAutoAt);}
   if(data.qualityDecision){const p=data.qualityDecision;if(!db.prepare("UPDATE quality_proposals SET status=?,updated=? WHERE id=? AND status='pending'").run(p.status,p.updated,p.id).changes)throw new Error('conflict');
    const current=db.prepare('SELECT * FROM quality_proposals WHERE id=?').get(p.id);
    if(['confirmed','applied'].includes(p.status)&&data.action!=='quality.auto_cooldown'&&current.kind==='review'){
     const confirmed=db.prepare("SELECT count(*) n FROM quality_proposals WHERE engine=? AND capability=? AND kind='review' AND status IN ('confirmed','applied') AND updated>?").get(current.engine,current.capability,p.updated-7*86400000).n;
     if(confirmed>=3&&!db.prepare("SELECT id FROM quality_proposals WHERE engine=? AND capability=? AND kind='disable' AND status='pending'").get(current.engine,current.capability))db.prepare('INSERT INTO quality_proposals VALUES (?,?,?,?,?,?,?)').run('disable-'+p.id,current.engine,current.capability,'disable','pending',p.updated,p.updated);
    }
   }
   db.prepare('UPDATE metadata SET revision=?, mode=COALESCE(?,mode) WHERE id=1').run(revision,data.mode || null);
   db.prepare('INSERT INTO audit(time,actor,action,target,reason,revision,requestKey,digest) VALUES (?,?,?,?,?,?,?,?)').run(Date.now(),data.actor,data.action,data.target,data.reason,revision,data.requestKey,data.digest);
   return read();
  });
  else if(op==='guards')value=transaction(()=>{for(const [key,guard]of data)db.prepare('INSERT INTO guards VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(guard));return true;});
  else if(op==='events'){
   value=transaction(()=>data.map(e=>{
    const seq=Number(db.prepare('INSERT INTO events(time,value) VALUES (?,?)').run(Date.parse(e.time),JSON.stringify(e)).lastInsertRowid);
    if(e.type.endsWith('engine.observed.v1'))db.prepare('INSERT INTO aggregates(minute,engine,origin,total,errors,duration) VALUES (?,?,?,1,?,?) ON CONFLICT(minute,engine,origin) DO UPDATE SET total=total+1,errors=errors+excluded.errors,duration=duration+excluded.duration').run(Math.floor(Date.parse(e.time)/60000)*60000,e.data.engineId,e.data.origin,e.data.outcome==='error'?1:0,Math.round(e.data.durationMs||0));
    return {seq,...e};
   }));rotate();
  }else if(op==='rotate'){rotate();value=true;}
  else if(op==='close'){db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();value=true;}
  else throw new Error('operation');
  parentPort.postMessage({id,value});
 }catch(e){parentPort.postMessage({id,error:['conflict','proof_used'].includes(e.message)?e.message:'storage_unavailable'});}
});
parentPort.postMessage({ready:true});
