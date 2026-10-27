const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.join(process.env.QA_TOOLS_PATH || '/tmp/ticketlelo-qa-tools','package.json'))('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(!['127.0.0.1','localhost'].includes(u.hostname))return r.abort('blockedbyclient');
   if(u.pathname.startsWith('/embed/'))return r.fulfill({contentType:'text/html',body:'<!doctype html><title>QA embed transport fixture</title>'});
   return r.continue();
  });
  await page.goto('http://127.0.0.1:3027/user-login/?ref=QA26&utm_source=qa-campus&utm_campaign=qa-fest');
  await page.setContent('<div id="qa-embed"></div>');
  await page.addScriptTag({path:path.resolve('public/sdk/embed.js')});
  const results=await page.evaluate(async()=>{
   let callbacks=0;
   const inst=TicketLeloEmbed.init({eventId:'qa-event',container:'#qa-embed',theme:'dark',onSuccess:()=>callbacks++});
   const win=inst.iframe.contentWindow;
   const result=[];
   const params=new URL(inst.iframe.src).searchParams;
   result.push({name:'EMB-01 SDK forwards referral, UTM and theme into iframe URL',pass:params.get('ref')==='QA26'&&params.get('utm_source')==='qa-campus'&&params.get('utm_campaign')==='qa-fest'&&params.get('theme')==='dark',src:inst.iframe.src});
   function send(origin,source,type,rest){window.dispatchEvent(new MessageEvent('message',{origin,source,data:{type,...rest}}));}
   send('https://untrusted.invalid',win,'ticketlelo:success',{ticket:{id:'forged'}});
   send(location.origin,window,'ticketlelo:success',{ticket:{id:'forged'}});
   result.push({name:'EMB-02 ignores foreign origin and wrong window success',pass:callbacks===0});
   send(location.origin,win,'ticketlelo:success',{ticket:{id:'qa-transport-only'}});
   result.push({name:'EMB-03 accepts only expected frame and origin callback',pass:callbacks===1});
   send(location.origin,win,'ticketlelo:resize',{height:'invalid'});
   result.push({name:'EMB-04 ignores nonnumeric height',pass:inst.iframe.style.height!=='NaNpx'});
   send(location.origin,win,'ticketlelo:resize',{height:99999999});
   result.push({name:'EMB-05 bounds resize height',pass:inst.iframe.style.height==='10000px'});
   inst.destroy();send(location.origin,win,'ticketlelo:success',{ticket:{id:'qa-after-destroy'}});result.push({name:'EMB-06 destroys iframe and listener',pass:!document.querySelector('iframe')&&callbacks===1});
   return result;
  });
  console.log(JSON.stringify(results,null,2));
  fs.writeFileSync('docs/qa/2026-10-25/evidence/embed-results.json',JSON.stringify(results,null,2));
  process.exitCode=results.every(r=>r.pass)?0:1;
 }finally{await browser.close();}
})();
