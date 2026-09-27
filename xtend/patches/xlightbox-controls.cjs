const fs=require('node:fs');
// App-local extension of the pinned 0.8.0 component. No SDK files are modified.
// A named slot places our carousel controls INSIDE the existing modal dialog.
module.exports={name:'xtend-search-lightbox-controls',setup(build){
 build.onLoad({filter:/[/\\]components[/\\]xlightbox\.js$/},({path})=>{
  const source=fs.readFileSync(path,'utf8');
  const anchor='          <img part="media" src="" alt="">';
  if(source.split(anchor).length!==2)throw new Error('XLightbox slot patch needs review for this SDK version.');
  return {contents:source.replace(anchor,anchor+'\n          <slot name="controls"></slot>'),loader:'js',resolveDir:require('node:path').dirname(path)};
 });
}};
