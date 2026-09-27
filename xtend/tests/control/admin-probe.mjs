import {chromium} from 'playwright';
const browser=await chromium.launch(),page=await browser.newPage();
page.on('request',r=>{if(r.url().includes('/services/admin.')&&!r.url().endsWith('events'))console.log(r.url(),r.postData());});
page.on('pageerror',e=>console.log('error',e.message));
try{await page.goto('http://localhost:8093/admin');await page.getByRole('link',{name:'Mit Nextcloud anmelden'}).click();await page.getByRole('link',{name:'administrator',exact:true}).click();await page.waitForFunction(()=>window.XTendPage);const button=page.locator('.engine-choice').filter({hasText:'fixture medium'});console.log(await button.evaluate(e=>e.outerHTML));await button.click();await page.waitForTimeout(1000);console.log('selected',await page.locator('.engine-detail h3').textContent());console.log('model',await page.evaluate(()=>window.XTendPage.getRuntime().model.getState('admin.data').selected));}finally{await browser.close();}
