import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8187';
const app=path.resolve(process.env.QA_APP_PATH || '.');
const load=rel=>import(pathToFileURL(path.join(app,rel)));
const admin=(await load('node_modules/firebase-admin/lib/index.js')).default;
admin.initializeApp({projectId:'demo-ticketlelo-qa'});
const eventId='qa-backend-'+Date.now();
await admin.firestore().collection('events').doc(eventId).set({title:'QA backend rules',isPublished:true,visibility:'public',globalCapacity:100});
const {db}=await load('lib/firebase.js');
const {connectFirestoreEmulator,terminate}=await load('node_modules/firebase/firestore/dist/index.mjs');
connectFirestoreEmulator(db,'127.0.0.1',8187);
const {reserveTicketCapacity}=await load('lib/capacity-reservation.js');
let result;
try{
 const reservation=await reserveTicketCapacity({parentEventId:eventId,ticketConfig:{id:'general',title:'QA General'},quantity:1});
 result={name:'BACKEND-01 checkout reservation using the same unauthenticated client SDK as API routes under repository rules',pass:true,reservationId:reservation.id};
}catch(e){result={name:'BACKEND-01 checkout reservation using the same unauthenticated client SDK as API routes under repository rules',pass:false,errorCode:e.code,error:e.message,scope:'Admin SDK seeds a synthetic public event; actual production reservation function uses Firebase client SDK and repository rules'};}
finally{await terminate(db);await admin.app().delete();}
console.log(JSON.stringify(result,null,2));
if(process.env.QA_RESULT_FILE)fs.writeFileSync(process.env.QA_RESULT_FILE,JSON.stringify(result,null,2));
process.exitCode=result.pass?0:1;
