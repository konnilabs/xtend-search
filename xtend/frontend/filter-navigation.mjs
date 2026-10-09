// Read native controls; XTend remains responsible for state and navigation.
let draft=null;
export function categoryDraftUrl(href, values, origin){
 const url=new URL(href,origin);
 if(url.origin!==origin||!['/','/search'].includes(url.pathname))throw new Error('Invalid category link');
 for(const name of ['q','language','time_range','safesearch'])url.searchParams.set(name,String(values.get(name)??''));
 url.searchParams.delete('pageno');url.searchParams.delete('cursor');
 url.pathname=url.searchParams.get('q')?.trim()?'/search':'/';
 return url.pathname+url.search;
}
export function preserveFilterDraft(props){return draft?{...props,'search.filters':{...draft}}:props;}
export function installFilterNavigation(command){
 let revision=0,submitted=0,pending=false,committedUrl=location.pathname+location.search;
 const read=()=>{const form=document.getElementById('search-form');if(!form)return null;const data=new FormData(form);return {language:data.get('language'),timeRange:data.get('time_range'),safeSearch:data.get('safesearch')};};
 window.addEventListener('change',event=>{
  const field={language:'language','time-range':'timeRange','safe-search':'safeSearch'}[event.target.id];
  if(field){draft={...(draft||read()),[field]:event.target.value};revision++;}
 },true);
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('.category-tabs a');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!window.XTendPage?.getRuntime())return;
  const form=document.getElementById('search-form');if(!form)return;
  const url=categoryDraftUrl(link.href,new FormData(form),location.origin);
  event.preventDefault();event.stopImmediatePropagation();
  void window.XTendPage.visit(url).catch(()=>{});
 },true);
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){pending=true;submitted=revision;}
  if(event.type==='navigate'){
   // PageClient emits navigate for optimistic stream commits too. Only an
   // actual visit/history transition establishes new authoritative filters.
   const url=event.page.url;if(!pending&&url===committedUrl)return;
   const newer=pending&&revision>submitted;
   const values=newer&&draft?draft:event.page.props?.['search.filters'];pending=false;committedUrl=url;
   if(values){draft={...values};void command('search.filters.restore',{value:draft});}
  }
  if(event.type==='error')pending=false;
 });
}
