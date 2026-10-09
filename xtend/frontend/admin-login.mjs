import '@ccslabs/xtend/components/xbutton.js';
// XButton exposes clicks, not href. Keep a native link until upgrade succeeds.
const button=document.getElementById('ccs-login'),fallback=document.getElementById('ccs-login-fallback');
if(button&&fallback){
 await customElements.whenDefined('x-button');
 button.addEventListener('click',()=>{button.setLoading(true);location.assign(fallback.href);});
 button.hidden=false;fallback.hidden=true;
}
