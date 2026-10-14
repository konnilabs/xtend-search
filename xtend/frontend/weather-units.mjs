// XToggle's native change handler in the pinned SDK compares the already
// changed input value and drops toggle-changed. Activate its public method
// instead; RMT remains the sole owner of the temperature-unit preference.
// Remove this adapter after the upstream native-event regression is fixed.
export function installWeatherUnitActivation(){
 const toggle=event=>event.composedPath().find(node=>node?.id==='weather-unit-toggle');
 document.addEventListener('click',event=>{
  const control=toggle(event);if(!control||typeof control.toggle!=='function')return;
  event.preventDefault();control.focus();control.toggle();
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key!==' ')return;const control=toggle(event);if(!control||typeof control.toggle!=='function')return;
  event.preventDefault();control.toggle();
 },true);
}
