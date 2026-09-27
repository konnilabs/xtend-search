import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {feedbackForm} from '../shared/feedback-form.mjs';
export function installFeedback(){
 let dialog,opener,context,registry,transport,busy=false;
 const inert=new Map();let overflow='',position;
 const restore=()=>{for(const [node,value]of inert)node.inert=value;inert.clear();document.documentElement.style.overflow=overflow;queueMicrotask(()=>{opener?.focus({preventScroll:true});if(position)scrollTo(...position);});};
 document.addEventListener('click',async event=>{
  const link=event.target.closest('a[data-report]');if(!link||event.button||event.metaKey||event.ctrlKey||event.shiftKey)return;
  event.preventDefault();if(busy)return;busy=true;opener=link;
  try{
   const [response]=await Promise.all([fetch(link.href,{headers:{Accept:'application/json'},credentials:'same-origin'}),import('@ccslabs/xtend/components/xdialog.js'),import('@ccslabs/xtend/components/xtoast.js')]);
   if(!response.ok)throw Error('context');context=await response.json();await customElements.whenDefined('x-dialog');
   registry?.dispose();transport?.dispose?.();transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services',headers:{'X-CSRF-Token':context.csrf}});registry=createAppServiceRegistry(services,{transport,historyLimit:0});
   if(!dialog){dialog=document.createElement('x-dialog');dialog.id='search-feedback';dialog.setAttribute('overlay','');dialog.setAttribute('title','Ergebnis melden');dialog.setAttribute('width','min(620px, calc(100vw - 24px))');document.body.append(dialog);
    dialog.addEventListener('dialog-opened',()=>{position=[scrollX,scrollY];overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';for(const node of document.body.children){if(node!==dialog){inert.set(node,node.inert);node.inert=true;}}});
    dialog.addEventListener('dialog-closed',restore);
    dialog.addEventListener('submit',async event=>{if(event.target.id!=='feedback-form')return;event.preventDefault();if(busy)return;busy=true;const form=event.target,button=form.querySelector('button');button.disabled=true;
     try{const result=await registry.invoke('search.feedback.submit',{ticket:context.ticket,reason:form.elements.reason.value,includeUrl:form.elements.includeUrl.checked});
      dialog.close({source:'submitted'});const toast=document.createElement('x-toast');toast.setAttribute('type','success');toast.setAttribute('duration','6000');toast.className='feedback-toast';toast.textContent=result.message||'Meldung aufgenommen.';document.body.append(toast);toast.addEventListener('toast-dismissed',()=>toast.remove(),{once:true});
     }catch(error){form.querySelector('.feedback-error').textContent=error.message||'Meldung nicht angenommen. Bitte erneut versuchen.';}
     finally{busy=false;button.disabled=false;}
    });
   }
   dialog.innerHTML=feedbackForm(context);dialog.open();
  }catch{location.assign(link.href);}finally{busy=false;}
 },true);
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')dialog?.close({source:'navigation'});});
}
