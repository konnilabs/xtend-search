export const IMAGE_PLACEHOLDER='/assets/xtend/image-placeholder.svg';
const signed=src=>/^\/(?:media|image_proxy)\?/.test(src||'');
// At most one different, already server-issued alternative. No retry loop,
// direct provider request or untrusted URL construction in the browser.
export function projectResultThumbnails(rows,failed){
 return rows.map(row=>{
  if(!failed.has(row.thumbnail))return row;
  const fallback=signed(row.previewSrc)&&row.previewSrc!==row.thumbnail&&!failed.has(row.previewSrc);
  return {...row,thumbnail:fallback?row.previewSrc:IMAGE_PLACEHOLDER,thumbnailKey:row.thumbnailKey+(fallback?':original-fallback':':unavailable'),thumbnailAlt:fallback?row.thumbnailAlt:'Bild nicht verfügbar',thumbnailFailed:!fallback,thumbnailFallback:!!fallback};
 });
}
