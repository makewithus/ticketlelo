import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const app=path.resolve(process.env.QA_APP_PATH || '.');
const {db}=await import(pathToFileURL(path.join(app,'lib/firebase.js')));
const {connectFirestoreEmulator,doc,setDoc,getDoc,terminate}=await import(pathToFileURL(path.join(app,'node_modules/firebase/firestore/dist/index.mjs'))).catch(()=>import('firebase/firestore'));
connectFirestoreEmulator(db,'127.0.0.1',8188);
const {reserveTicketCapacity,releaseCapacityReservation}=await import(pathToFileURL(path.join(app,'lib/capacity-reservation.js')));
const results=[];
const id='qa-cap-'+Date.now();
try{
 await setDoc(doc(db,'events',id),{title:'QA Capacity',globalCapacity:100});
 await setDoc(doc(db,'subEvents',id+'-a'),{title:'QA A',parentEventId:id,capacity:2,allocatedSeats:0});
 await setDoc(doc(db,'subEvents',id+'-b'),{title:'QA B',parentEventId:id,capacity:2,allocatedSeats:0});
 const config={id:id+'-combo',title:'QA Combo',tierType:'combo',includedSubEventIds:[id+'-a',id+'-b']};
 await setDoc(doc(db,'combos',config.id),{...config,parentEventId:id,dedicatedQuota:2,allocatedCount:0});
 const start=performance.now();const durations=[];
 const purchases=await Promise.allSettled(Array.from({length:10},async(_,i)=>{const t=performance.now();try{return await reserveTicketCapacity({parentEventId:id,ticketConfig:config,buyerEmail:`buyer${i}@example.invalid`});}finally{durations.push(performance.now()-t);}}));
 const winners=purchases.filter(r=>r.status==='fulfilled').map(r=>r.value);
 const allocated=(await getDoc(doc(db,'subEvents',id+'-a'))).data().allocatedSeats;
 durations.sort((a,b)=>a-b);
 results.push({name:'CAP-01 real Firestore transactions: ten buyers for two seats',pass:winners.length===2&&allocated===2,winners:winners.length,rejected:purchases.length-winners.length,persistedAllocated:allocated,concurrency:10,durationMs:performance.now()-start,p50Ms:durations[4],p95Ms:durations[9],environment:'local Firestore emulator, explicit permissive test rules for service-layer algorithm only'});
 const released=await releaseCapacityReservation(winners[0].id);
 const after=(await getDoc(doc(db,'subEvents',id+'-a'))).data().allocatedSeats;
 const afterB=(await getDoc(doc(db,'subEvents',id+'-b'))).data().allocatedSeats;
 const afterCombo=(await getDoc(doc(db,'combos',config.id))).data().allocatedCount;
 results.push({name:'CAP-02 multi-track reservation releases inventory',pass:released&&after===1&&afterB===1&&afterCombo===1,released,persistedAllocated:after,persistedAllocatedB:afterB,persistedComboAllocated:afterCombo});
 const again=await releaseCapacityReservation(winners[0].id);
 results.push({name:'CAP-03 release is idempotent',pass:again&&(await getDoc(doc(db,'subEvents',id+'-a'))).data().allocatedSeats===1});
 await setDoc(doc(db,'events',id+'-global'),{title:'QA Global',globalCapacity:1});
 const general={id:'general',title:'QA General',tierType:'single'};
 const g=await Promise.allSettled(Array.from({length:3},()=>reserveTicketCapacity({parentEventId:id+'-global',ticketConfig:general})));
 results.push({name:'CAP-04 parent global capacity enforces one attendee',pass:g.filter(r=>r.status==='fulfilled').length===1,actualReservations:g.filter(r=>r.status==='fulfilled').length,expected:1});
 try { await reserveTicketCapacity({parentEventId:id,ticketConfig:general,quantity:-1});results.push({name:'CAP-05 reject negative reservation quantity',pass:false});}catch(e){results.push({name:'CAP-05 reject negative reservation quantity',pass:true,error:e.message});}
}finally{await terminate(db);}
console.log(JSON.stringify(results,null,2));
if(process.env.QA_RESULT_FILE)fs.writeFileSync(process.env.QA_RESULT_FILE,JSON.stringify(results,null,2));
process.exitCode=results.every(r=>r.pass)?0:1;
