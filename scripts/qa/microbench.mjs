import fs from 'node:fs';
import { generateSignedQRPayload,verifySignedQRPayload } from '../../lib/qr.js';
import { calculateOrderPricing } from '../../lib/pricing.js';
const payload=generateSignedQRPayload({ticketId:'qa-bench',eventSlug:'qa-event',entitledSubEventIds:['qa-track']},'synthetic-qa-bench-secret');
const results=[];
for(const [name,fn] of [['QR HMAC verification',()=>verifySignedQRPayload(payload,'synthetic-qa-bench-secret')],['Pricing calculation',()=>calculateOrderPricing({basePrice:449.1,quantity:1,isTaxInclusive:true})]]){
 for(let i=0;i<100;i++)fn();
 const latencies=[];
 for(let i=0;i<1000;i++){const start=performance.now();fn();latencies.push(performance.now()-start);}
 latencies.sort((a,b)=>a-b);results.push({name,sampleSize:1000,concurrency:1,errors:0,p50Ms:latencies[499],p95Ms:latencies[949],p99Ms:latencies[989],totalMs:latencies.reduce((a,b)=>a+b,0),scope:'isolated synchronous function only; excludes API, network, database and browser'});
}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,results},null,2));
if(process.env.QA_RESULT_FILE)fs.writeFileSync(process.env.QA_RESULT_FILE,JSON.stringify(results,null,2));
