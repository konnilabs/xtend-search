// Every completion is correlated again at serialized RMT action execution.
export function applyPreviewAction(input,context){
 const reader=context?.stateRuntime;if(typeof reader?.getState!=='function')throw Error('Preview action requires the Maraca Action Model reader');
 return applyPreviewUpdate(input,reader.getState('search.preview'));
}
export function applyPreviewUpdate({value},current){
 if(!current?.open)return {value:current};
 if(value.type==='loaded'&&value.key===current.imageKey)return {value:{...current,imageLoading:false}};
 if(value.type==='failure'&&value.expectedKey===current.imageKey)return {value:{...current,imageSrc:value.src,imageKey:value.key,imageUnavailable:value.unavailable,imageMessage:value.message,imageLoading:!!value.src}};
 if(value.type==='expansion'&&value.id===current.id&&(value.busy||value.token===current.expansionToken))return {value:{...current,expansionLoading:value.busy,expansionToken:value.token,expandMessage:value.message||''}};
 return {value:current};
}
