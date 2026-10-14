import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=new URL('../../',import.meta.url).pathname;
const methods=new Set(['createElement','createElementNS','createTextNode','createDocumentFragment','createContextualFragment','parseFromString','write','writeln','append','appendChild','prepend','replaceChild','replaceChildren','replaceWith','remove','insertBefore','insertAdjacentHTML','insertAdjacentElement','setAttribute','removeAttribute','toggleAttribute','attachShadow']);
const properties=new Set(['innerHTML','outerHTML','textContent','innerText','value','checked','hidden','disabled','inert','style','className','src','href','open','scrollTop','scrollLeft']);
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(directory,item.name)):/\.(mjs|ts)$/.test(item.name)?[path.join(directory,item.name)]:[]);}
export function violations(text,file='frontend/probe.mjs'){
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),hits=[],urlParams=new Set();
 function report(node,reason){hits.push({file,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,reason});}
 function visit(node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isNewExpression(node.initializer)&&node.initializer.expression.getText(source)==='URLSearchParams')urlParams.add(node.name.text);
  if(ts.isNewExpression(node)&&node.expression.getText(source)==='DOMParser')report(node,'HTML parser');
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   const access=node.expression,name=access.name.text,receiver=access.expression.getText(source);
   if(methods.has(name)&&!(name==='append'&&urlParams.has(receiver)))report(node,'DOM mutation '+name);
   if(/\.classList$/.test(receiver)&&['add','remove','toggle','replace'].includes(name))report(node,'classList mutation');
  }
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment){
   const left=node.left;
   if(ts.isPropertyAccessExpression(left)){
    const name=left.name.text,receiver=left.expression.getText(source);
    // Exactly the horizontal scroll capability adapter; no visual properties.
    const scrollAdapter=file==='frontend/category-tabs.mjs'&&name==='scrollLeft'&&receiver==='nav';
    if(properties.has(name)&&!scrollAdapter||/\.(style|dataset)$/.test(receiver))report(node,'DOM property '+name);
   }
   if(ts.isElementAccessExpression(left)&&left.argumentExpression&&ts.isStringLiteral(left.argumentExpression)&&properties.has(left.argumentExpression.text))report(node,'computed DOM property');
  }
  if(ts.isIdentifier(node)&&['createRmtDomDescriptorRenderer','createRmtDomViewAdapter'].includes(node.text))report(node,'Application renderer ownership');
  ts.forEachChild(node,visit);
 }
 visit(source);return hits;
}
test('all application browser sources have no imperative View writes',()=>{
 const hits=files(path.join(root,'frontend')).concat(files(path.join(root,'admin'))).flatMap(file=>violations(fs.readFileSync(file,'utf8'),path.relative(root,file)));
 assert.deepEqual(hits,[]);
});
test('architecture check rejects hidden HTML sinks, aliases and computed writes',()=>{
 for(const source of ['const node=document.createElement("p")','const node=view;node.checked=true','view["innerHTML"]=payload','wrapper.replaceChildren(node)','view.style.color="red"','view.classList.add("open")','const parser=new DOMParser()','renderer.commit(createRmtDomDescriptorRenderer())'])assert.ok(violations(source).length,source);
 assert.deepEqual(violations('const params=new URLSearchParams();params.append("q","text")'),[]);
 assert.ok(violations('node.scrollLeft=12').length);
 assert.deepEqual(violations('nav.scrollLeft=12','frontend/category-tabs.mjs'),[]);
});
