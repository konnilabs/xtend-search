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
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),hits=[],urlParams=new Set(),aliases=new Map();
 function report(node,reason){hits.push({file,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,reason});}
 function member(node){
  if(ts.isPropertyAccessExpression(node))return {name:node.name.text,receiver:node.expression.getText(source)};
  if(ts.isElementAccessExpression(node)&&node.argumentExpression&&ts.isStringLiteralLike(node.argumentExpression))return {name:node.argumentExpression.text,receiver:node.expression.getText(source)};
  return null;
 }
 function aliasOf(node){
  if(!node)return null;if(ts.isIdentifier(node))return aliases.get(node.text)||null;
  const access=member(node);if(access&&(methods.has(access.name)||['focus','scrollTo','scrollIntoView'].includes(access.name))&&!(access.name==='append'&&urlParams.has(access.receiver)))return access.name;
  if(ts.isCallExpression(node)){const method=member(node.expression);if(method?.name==='bind')return aliasOf(node.expression.expression);}
  return null;
 }
 function visit(node){
  if(ts.isVariableDeclaration(node)){
   if(ts.isIdentifier(node.name)&&node.initializer&&ts.isNewExpression(node.initializer)&&node.initializer.expression.getText(source)==='URLSearchParams')urlParams.add(node.name.text);
   if(ts.isIdentifier(node.name)){const alias=aliasOf(node.initializer);if(alias)aliases.set(node.name.text,alias);}
   if(ts.isObjectBindingPattern(node.name))for(const element of node.name.elements){
    const property=element.propertyName||element.name,name=ts.isIdentifier(property)||ts.isStringLiteralLike(property)?property.text:null;
    if(name&&methods.has(name)&&ts.isIdentifier(element.name)&&!(name==='append'&&urlParams.has(node.initializer?.getText(source))))aliases.set(element.name.text,name);
   }
  }
  if(ts.isNewExpression(node)&&node.expression.getText(source)==='DOMParser')report(node,'HTML parser');
  if(ts.isCallExpression(node)){
   const access=member(node.expression);
   if(access){const {name,receiver}=access;
    if(['focus','scrollTo','scrollIntoView'].includes(name)&&file!=='frontend/browser-capabilities.mjs')report(node,'Browser capability outside adapter');
    if(methods.has(name)&&!(name==='append'&&urlParams.has(receiver)))report(node,'DOM mutation '+name);
    if(/\.classList$/.test(receiver)&&['add','remove','toggle','replace'].includes(name))report(node,'classList mutation');
    if(['call','apply'].includes(name)&&aliases.has(receiver))report(node,'Aliased DOM mutation '+aliases.get(receiver));
   }else if(ts.isIdentifier(node.expression)&&aliases.has(node.expression.text))report(node,'Aliased DOM mutation '+aliases.get(node.expression.text));
  }
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment){
   const left=node.left;
   if(ts.isIdentifier(left)){const alias=aliasOf(node.right);if(alias)aliases.set(left.text,alias);}
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
test('architecture check rejects static computed sinks and simple local method aliases',()=>{
 for(const source of ['const node=document.createElement("p")','const node=view;node.checked=true','view["innerHTML"]=payload','wrapper.replaceChildren(node)','view.style.color="red"','view.classList.add("open")','const parser=new DOMParser()','renderer.commit(createRmtDomDescriptorRenderer())',
  "node['setAttribute']('hidden','')",
  "const write=node.setAttribute;write('hidden','')",
  "const write=node['setAttribute'].bind(node);write('hidden','')",
  "const {setAttribute:write}=node;write('hidden','')",
  "const {replaceChildren}=node;replaceChildren(child)",
  "let write;write=node.setAttribute;write.call(node,'hidden','')",
  "const write=node.setAttribute;const aliased=write;aliased.apply(node,['hidden',''])"])assert.ok(violations(source).length,source);
 assert.deepEqual(violations('const params=new URLSearchParams();params.append("q","text")'),[]);
 assert.ok(violations('node.scrollLeft=12').length);
 assert.deepEqual(violations('nav.scrollLeft=12','frontend/category-tabs.mjs'),[]);
});
