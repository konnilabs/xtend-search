import '@ccslabs/xtend/components/xbutton.js';
// CSS :defined owns progressive visibility; the native anchor is the fallback.
const button=document.getElementById('ccs-login'),fallback=document.getElementById('ccs-login-fallback');
if(button&&fallback){
 await customElements.whenDefined('x-button');
 button.addEventListener('click',()=>{button.setLoading(true);location.assign(fallback.href);});
}
