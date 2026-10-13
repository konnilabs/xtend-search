import {feedbackForm} from '../../shared/feedback-form.mjs';
export async function feedbackHttp(req,res,url,app){
 res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Type','text/html; charset=utf-8');
 let input={ticket:url.searchParams.get('ticket')||''},context=app.quality.browser(req,res),error='';
 if(req.method==='POST'){
  if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){res.writeHead(415);res.end();return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384){res.writeHead(413);res.end();return;}}
  const p=new URLSearchParams(body);input={ticket:p.get('ticket'),reason:p.get('reason'),includeUrl:p.get('includeUrl')==='on'};
  req.headers['x-csrf-token']=p.get('csrf');
  try{context=app.quality.protect(req,res,app.auth.origin);await app.quality.submit(input,context);res.end(page('<h1>Vielen Dank</h1><p>Deine Meldung wurde aufgenommen.</p><a href="/">Zur Suche</a>'));return;}
  catch(e){error=e.expose?e.message:'Die Meldung konnte nicht angenommen werden.';res.statusCode=e.code==='xsearch.feedback_limit'?429:400;}
 }
 let claims;try{claims=app.quality.claims(input.ticket);}catch{res.statusCode=400;res.end(page('<h1>Ergebnisnachweis abgelaufen</h1><p>Bitte die Suche erneut aufrufen.</p><a href="/">Zur Suche</a>'));return;}
 const values={...input,url:claims.url,csrf:context.csrf,error};
 if(req.method==='GET'&&req.headers.accept==='application/json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(values));return;}
 res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 res.end(page('<h1>Ergebnis melden</h1>'+feedbackForm(values)));
}
function page(content){return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ergebnis melden · XTend.search</title><link rel="icon" href="/assets/xtend/favicon.png"><link rel="stylesheet" href="/assets/xtend/standalone/search.css"><main class="feedback-page">'+content+'</main></html>';}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function feedbackBatchHttp(req,res,url,app){
 res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','private, no-store');let params=url.searchParams;
 if(req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){res.writeHead(415);res.end();return;}let body='';for await(const c of req){body+=c;if(Buffer.byteLength(body)>65536){res.writeHead(413);res.end();return;}}params=new URLSearchParams(body);}
 const tickets=params.getAll('ticket');if(!tickets.length||tickets.length>5){res.writeHead(400);res.end('Bitte 1–5 Ergebnisse auswählen.');return;}
 let claims;try{claims=tickets.map(t=>app.quality.claims(t));}catch{res.writeHead(400);res.end(page('<h1>Ergebnisnachweis abgelaufen</h1><p>Bitte die Suche erneut aufrufen.</p>'));return;}
 let context=app.quality.browser(req,res),error='';
 if(req.method==='GET'&&req.headers.accept==='application/json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({csrf:context.csrf,links:claims.map(c=>({id:c.id,url:c.url}))}));return;}
 if(req.method==='POST'){
  req.headers['x-csrf-token']=params.get('csrf');try{context=app.quality.protect(req,res,app.auth.origin);await app.quality.submitBatch({tickets,reason:params.get('reason'),includeUrl:params.get('includeUrl')==='on',requestKey:params.get('requestKey')},context);res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page('<h1>Vielen Dank</h1><p>Deine Meldung wurde aufgenommen.</p><a href="/">Zur Suche</a>'));return;}catch(e){error=e.expose?e.message:'Meldung konnte nicht angenommen werden.';res.statusCode=e.code?.includes('feedback_limit')?429:400;}
 }
 const {FEEDBACK_REASONS}=await import('../../shared/feedback.mjs'),{randomUUID}=await import('node:crypto');
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 res.end(page('<h1>Ergebnisse melden</h1><form id="feedback-form" method="post" action="/feedback/batch">'+tickets.map(t=>'<input type="hidden" name="ticket" value="'+escape(t)+'">').join('')+'<input type="hidden" name="csrf" value="'+escape(context.csrf)+'"><input type="hidden" name="requestKey" value="'+escape(params.get('requestKey')||randomUUID())+'"><label>Meldegrund<select name="reason" required><option value="">Bitte auswählen</option>'+Object.entries(FEEDBACK_REASONS).map(([id,label])=>'<option value="'+id+'"'+(params.get('reason')===id?' selected':'')+'>'+escape(label)+'</option>').join('')+'</select></label><label><input type="checkbox" name="includeUrl"'+(params.get('includeUrl')==='on'?' checked':'')+'> Ergebnislinks zur Prüfung mitsenden</label><ul>'+claims.map(c=>'<li>'+escape(c.url)+'</li>').join('')+'</ul><p>Ohne Zustimmung werden keine Ergebnislinks gespeichert. Freiwillige Belege werden spätestens nach sieben Tagen gelöscht.</p><p role="alert">'+escape(error)+'</p><button type="submit">Meldung speichern</button><a href="/">Meldung abbrechen</a></form>'));
}
