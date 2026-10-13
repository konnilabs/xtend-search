// Static component chrome only. Content uses text nodes, never an HTML parser.
export function element(tag,attributes={},children=[]){
 const node=['svg','path','circle','line','polyline','polygon','rect','g'].includes(tag)?document.createElementNS('http://www.w3.org/2000/svg',tag):document.createElement(tag);
 for(const [name,value]of Object.entries(attributes))if(value!==null&&value!==false)node.setAttribute(name,value===true?'':String(value));
 for(const child of children)node.append(typeof child==='string'?document.createTextNode(child):child);
 return node;
}
