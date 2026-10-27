const fs=require('node:fs');
process.loadEnvFile('.env');
(async()=>{
 const key=process.env.RAZORPAY_KEY_ID;
 if(!key?.startsWith('rzp_test_'))throw Error('Refusing provider request: verified sandbox key ID required');
 const secret=process.env.RAZORPAY_KEY_SECRET;
 if(!secret)throw Error('Sandbox secret missing');
 const response=await fetch('https://api.razorpay.com/v1/orders',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64')},
  body:JSON.stringify({amount:44910,currency:'INR',receipt:'qa_20261025_'+Date.now(),notes:{purpose:'TicketLelo isolated QA sandbox order only; no capture or real charge'}}),signal:AbortSignal.timeout(12000)
 });
 const body=await response.json();
 const result={integration:'Razorpay sandbox order API only',httpStatus:response.status,pass:response.ok&&body.amount===44910&&body.currency==='INR',order:response.ok?{id:body.id,amount:body.amount,currency:body.currency,status:body.status}:undefined,error:response.ok?undefined:{code:body.error?.code,description:String(body.error?.description||'').replaceAll(secret,'[REDACTED]').replaceAll(key,'[REDACTED]')},scope:'Provider order creation; no payment, charge, capture, refund or webhook delivery performed'};
 console.log(JSON.stringify(result,null,2));
 fs.writeFileSync('docs/qa/2026-10-25/evidence/razorpay-sandbox.json',JSON.stringify(result,null,2));
 process.exitCode=result.pass?0:1;
})().catch(e=>{console.error(JSON.stringify({pass:false,error:e.cause?.code||e.name,message:'Sandbox API unavailable; credentials suppressed'}));process.exitCode=1;});
