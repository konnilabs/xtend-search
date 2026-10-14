// Await the application model and the XButton's actual rendered control.
// selectOption() only completes the DOM interaction, not the derived-model commit.
export async function waitForFeedbackSave(page){
 await page.waitForFunction(()=>{
  const feedback=window.XTendPage?.getRuntime()?.model.getState('search.feedback');
  const host=document.getElementById('report-save');
  const button=host?.shadowRoot?.querySelector('button')||host?.querySelector('button');
  const enabled=node=>!!node&&!node.hasAttribute('disabled')&&node.getAttribute('aria-disabled')!=='true';
  return feedback?.open===true&&feedback.selected?.length===1&&feedback.reason==='spam'
   &&feedback.canSave===true&&feedback.busy===false&&enabled(host)&&enabled(button)&&!button.disabled;
 });
}
