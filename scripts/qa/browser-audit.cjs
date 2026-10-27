const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.join(process.env.QA_TOOLS_PATH || '/tmp/ticketlelo-qa-tools','package.json'));
const {chromium}=req('playwright');
(async()=>{
 const evidence=path.resolve(process.env.QA_EVIDENCE || 'docs/qa/2026-10-25/evidence');
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
 for(const width of [375,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort('blockedbyclient');});
  const page=await context.newPage();
  const errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failures.push({url:new URL(r.url()).origin,reason:r.failure()?.errorText}));
  for(const route of ['/user-login/','/organiser-login/','/admin/scanner/','/dashboard/','/ambassador/dashboard/']){
   const before=errors.length;
   try{
    const response=await page.goto('http://127.0.0.1:3027'+route,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1200);
    const dom=await page.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,1400),scrollWidth:document.documentElement.scrollWidth,innerWidth,inputs:[...document.querySelectorAll('input')].map(i=>({type:i.type,placeholder:i.placeholder,hasLabel:!!i.labels?.length || !!i.getAttribute('aria-label')}))}));
    const file=`browser-${width}-${route.split('/').filter(Boolean).join('-')}.png`;
    await page.screenshot({path:path.join(evidence,file),fullPage:true});
    results.push({route,width,httpStatus:response.status(),finalURL:page.url(),...dom,overflow:dom.scrollWidth>width,screenshot:file,pageErrors:errors.slice(before)});
   }catch(e){results.push({route,width,error:e.message});}
  }
  await page.goto('http://127.0.0.1:3027/user-login/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(700);
  const keyboard=[];
  for(let i=0;i<4;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({tag:document.activeElement.tagName,type:document.activeElement.type,text:document.activeElement.textContent?.slice(0,60)})));}
  results.push({width,check:'keyboard tab focus',observed:keyboard,networkFailures:failures});
  await context.close();
 }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(({text,inputs,networkFailures,...r})=>r),null,2));
})();
