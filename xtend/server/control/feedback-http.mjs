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
