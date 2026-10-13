import {inflateRawSync,crc32} from 'node:zlib';
// Bounded central-directory reader. No filesystem extraction, ZIP64 or links.
export function readZip(buffer,{maxBytes=32*1024*1024,maxEntries=4096}={}){
 if(!Buffer.isBuffer(buffer)||buffer.length>8*1024*1024)throw Error('archive_limit');let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('archive_invalid');const count=buffer.readUInt16LE(end+10);if(count>maxEntries||count===65535)throw Error('archive_limit');let offset=buffer.readUInt32LE(end+16),bytes=0;const output=new Map();
 for(let i=0;i<count;i++){
  if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw Error('archive_invalid');const method=buffer.readUInt16LE(offset+10),packed=buffer.readUInt32LE(offset+20),size=buffer.readUInt32LE(offset+24),n=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42),flags=buffer.readUInt16LE(offset+8),mode=buffer.readUInt32LE(offset+38)>>>16;
  const name=buffer.subarray(offset+46,offset+46+n).toString('utf8');if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||((mode&0xf000)===0xa000)||flags&1||output.has(name))throw Error('archive_path');bytes+=size;if(bytes>maxBytes||packed===0xffffffff||size===0xffffffff)throw Error('archive_limit');
  if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw Error('archive_invalid');const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+packed>buffer.length)throw Error('archive_invalid');const src=buffer.subarray(start,start+packed),data=method===0?src:method===8?inflateRawSync(src,{maxOutputLength:size+1}):null;if(!data||data.length!==size||crc32(data)!==buffer.readUInt32LE(offset+16))throw Error('archive_invalid');if(!name.endsWith('/'))output.set(name,data);offset+=46+n+extra+comment;
 }
 return output;
}
