// Geometry only. RMT owns both images; no clone or visual DOM write is needed.
export function containedMediaBox(rect,width,height){
 if(!rect||![rect.x,rect.y,rect.width,rect.height,width,height].every(Number.isFinite)||rect.width<=0||rect.height<=0||width<=0||height<=0)return null;
 const scale=Math.min(rect.width/width,rect.height/height),w=width*scale,h=height*scale;
 return {x:rect.x+(rect.width-w)/2,y:rect.y+(rect.height-h)/2,width:w,height:h};
}
export function mediaFlipKeyframes(from,to){
 if(!from||!to||![from.x,from.y,from.width,from.height,to.x,to.y,to.width,to.height].every(Number.isFinite)||Math.min(from.width,from.height,to.width,to.height)<=0)return null;
 const dx=from.x+from.width/2-to.x-to.width/2,dy=from.y+from.height/2-to.y-to.height/2,scale=Math.min(from.width/to.width,from.height/to.height);
 return [{opacity:1,transform:`translate(${dx}px,${dy}px) scale(${scale})`,transformOrigin:'50% 50%'},{opacity:1,transform:'none',transformOrigin:'50% 50%'}];
}
