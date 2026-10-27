const fs = require('node:fs');
(async()=>{
 const base=process.env.QA_BASE_URL || 'http://127.0.0.1:3027';
 if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local QA URL required');
 const probes=[
 ['HTTP-01 anonymous gate scan','POST','/api/verify-ticket/',{},401],
 ['HTTP-02 anonymous offline sync','POST','/api/verify-ticket/batch-sync/',{scans:[]},401],
 ['HTTP-03 anonymous certificate issue','POST','/api/certificates/',{},401],
 ['HTTP-04 anonymous webinar access','POST','/api/webinars/access/',{},401],
 ['HTTP-05 anonymous invoice','GET','/api/invoices/qa-order/',null,401],
 ['HTTP-06 anonymous Apple Wallet','GET','/api/wallet/apple/qa-ticket/',null,401],
 ['HTTP-07 anonymous Google Wallet','GET','/api/wallet/google/qa-ticket/',null,401],
 ['HTTP-08 anonymous analytics','GET','/api/analytics/qa-event/',null,401],
 ['HTTP-12 checkout without configured secret','POST','/api/create-order/',{eventId:'qa-event',quantity:1},503],
 ['HTTP-13 checkout rejects fractional quantity','POST','/api/create-order/',{eventId:'qa-event',quantity:1.5},400],
 ['HTTP-14 checkout rejects negative quantity','POST','/api/create-order/',{eventId:'qa-event',quantity:-1},400],
 ['HTTP-09 unsigned webhook','POST','/api/webhooks/razorpay/',{},400],
 ['HTTP-10 test-prefix webhook without configured secret','POST','/api/webhooks/razorpay/','invalid-json',503,{'x-razorpay-signature':'test_sig_untrusted'}],
 ['HTTP-11 payment verification without configured secret','POST','/api/verify-payment/',{razorpay_order_id:'order_sim_qa',razorpay_payment_id:'pay_qa',razorpay_signature:'fake'},503],
 ];
 const results=[];
 for(const [name,method,url,body,expected,headers={}] of probes){
  const start=performance.now();
  try{
   const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},body:body===null?undefined:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   const text=await response.text(); results.push({name,expected,status:response.status,pass:response.status===expected,body:text.slice(0,700),durationMs:Math.round(performance.now()-start)});
  }catch(e){results.push({name,expected,pass:false,error:e.message,durationMs:Math.round(performance.now()-start)});}
 }
 console.log(JSON.stringify(results,null,2));
 if(process.env.QA_RESULT_FILE)fs.writeFileSync(process.env.QA_RESULT_FILE,JSON.stringify(results,null,2));
 process.exitCode=results.every(r=>r.pass)?0:1;
})();
