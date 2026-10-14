// Compare-and-set presentation snapshots at the serialized RMT action boundary.
export function resultProjectionOwner(data){
 return {
  resource:JSON.stringify([data?.q??null,data?.category??null,data?.language??null,data?.timeRange??null,data?.safeSearch??null,
   data?.state??null,data?.cache?.identity??null,data?.cache?.epoch??null,data?.stream?.id??null]),
  results:JSON.stringify(data?.results||[])
 };
}
export function resultProjection(data,results){return {owner:resultProjectionOwner(data),results};}
export function restoreResultThumbnails(rows,canonical){
 const sources=new Map((canonical||[]).map(row=>[row.id,row]));
 return(rows||[]).map(row=>{
  const source=sources.get(row.id);if(!source)return row;
  return {...row,thumbnail:source.thumbnail,thumbnailKey:source.thumbnailKey,thumbnailAlt:source.thumbnailAlt,thumbnailFailed:!!source.thumbnailFailed};
 });
}
export function applyResultProjection({value},current){
 const owner=resultProjectionOwner(current);
 const accepted=Array.isArray(value?.results)&&value?.owner?.resource===owner.resource&&value.owner.results===owner.results;
 return {accepted,results:accepted?value.results:current?.results||[]};
}

// RMT datasource context contains the framework-owned read-only Action Model
// port. Read at action execution, not when a controller enqueues the command.
export function readActionSearchData(context){
 const reader=context?.stateRuntime;
 if(typeof reader?.getState!=='function')throw Error('search.images.apply requires the Maraca Action Model reader');
 return reader.getState('search.data');
}
