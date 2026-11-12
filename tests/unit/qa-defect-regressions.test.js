import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { calculateMerchandiseAddons } from '../../lib/merchandise.js';
import { getWebinarAccessWindow } from '../../lib/webinars.js';
import { generateTaxInvoiceData } from '../../lib/invoices.js';
import { calculateOrderPricing } from '../../lib/pricing.js';
import { syncRegistrationToGoogleSheet } from '../../lib/google-sheets.js';
import { sendWhatsAppCloudMessage } from '../../lib/communications.js';
import { generateAppleWalletPass, generateGoogleWalletPass } from '../../lib/wallet.js';

const catalog=[{id:'qa-shirt',name:'QA Shirt',stock:3,price:100}];
test('QA merchandise rejects fractional, zero, negative and nonfinite quantities',()=>{
 for(const quantity of [0,-1,1.5,Infinity,'bad']) assert.equal(calculateMerchandiseAddons(catalog,[{itemId:'qa-shirt',quantity}]).valid,false,`quantity=${quantity}`);
});
test('QA merchandise validates combined stock across repeated selections',()=>{
 assert.equal(calculateMerchandiseAddons(catalog,[{itemId:'qa-shirt',quantity:2,size:'S'},{itemId:'qa-shirt',quantity:2,size:'M'}]).valid,false);
});
test('QA webinar supports persisted Firestore Timestamp',()=>{
 const result=getWebinarAccessWindow(Timestamp.fromDate(new Date('2027-03-15T10:10:00Z')),new Date('2027-03-15T10:00:00Z'));
 assert.equal(result.isOpen,true);
});
test('QA invoice supports persisted Firestore Timestamp and authoritative pricing',()=>{
 const pricing=calculateOrderPricing({basePrice:449.10,isTaxInclusive:true});
 const invoice=generateTaxInvoiceData({order:{id:'qa-order',pricing,createdAt:Timestamp.fromDate(new Date('2027-03-01T10:00:00Z'))}});
 assert.equal(invoice.invoiceDate,'2027-03-01T10:00:00.000Z');
 assert.equal(invoice.financials.totalPayable,449.10);
 assert.equal(invoice.financials.totalGst,pricing.gstAmount);
 assert.equal(invoice.financials.convenienceFee,pricing.platformFee);
 assert.equal(Math.round((invoice.financials.subTotal+invoice.financials.totalGst+invoice.financials.convenienceFee)*100)/100,449.10);
});
test('QA Sheets never claims appended when no provider call exists',async()=>{
 const result=await syncRegistrationToGoogleSheet({id:'qa-registration'},[],{spreadsheetId:'qa-sheet',clientEmail:'qa@example.invalid',privateKey:'synthetic-key'});
 assert.equal(result.synced,false); assert.equal(result.requiresImplementation,true);
});
test('QA WhatsApp never claims delivery when no provider call exists',async()=>{
 const result=await sendWhatsAppCloudMessage({recipientPhone:'919999999999',messageText:'QA'},{token:'synthetic-token',phoneNumberId:'synthetic-id'});
 assert.equal(result.sent,false); assert.equal(result.requiresImplementation,true); assert.equal(result.messageId,undefined);
});
test('QA wallets never claim signed passes when only structures exist',async()=>{
 const keys=['APPLE_PASS_CERT','APPLE_PASS_KEY','GOOGLE_WALLET_SERVICE_ACCOUNT','GOOGLE_WALLET_ISSUER_ID'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const key of keys)process.env[key]='synthetic-qa-only';
  const apple=await generateAppleWalletPass({id:'qa-ticket'},{});
  const google=await generateGoogleWalletPass({id:'qa-ticket'},{});
  assert.equal(apple.available,false); assert.equal(apple.requiresImplementation,true);
  assert.equal(google.available,false); assert.equal(google.requiresImplementation,true); assert.equal(google.saveUrl,undefined);
 }finally{for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});

test('QA payment HMAC requires exact valid signature and configured secret',async()=>{
 const {verifyPaymentHmac,configuredPaymentSecret}=await import('../../lib/payment-security.js');
 const {createHmac}=await import('node:crypto');
 const secret='qa-local-synthetic-signing-secret';
 const body='{"event":"payment.captured"}';
 const signed=createHmac('sha256',secret).update(body).digest('hex');
 assert.equal(verifyPaymentHmac(body,signed,secret),true);
 assert.equal(verifyPaymentHmac(body+' ',signed,secret),false);
 for(const sig of ['test_sig_fake','sandbox_fake','',signed.slice(1)])assert.equal(verifyPaymentHmac(body,sig,secret),false);
 assert.equal(verifyPaymentHmac(body,signed,''),false);
 assert.equal(configuredPaymentSecret('rzp_placeholder'),null);
});
test('QA resource ownership rejects anonymous, empty-email and other attendees',async()=>{
 const {ownsResource,managesEvent}=await import('../../lib/access-policy.js');
 assert.equal(ownsResource(null,{buyerEmail:'qa@example.invalid'}),false);
 assert.equal(ownsResource({uid:'qa',email:''},{buyerEmail:''}),false);
 assert.equal(ownsResource({uid:'qa',email:'qa@example.invalid'},{buyerEmail:'other@example.invalid'}),false);
 assert.equal(ownsResource({uid:'qa',email:'QA@example.invalid'},{buyerEmail:'qa@example.invalid'}),true);
 assert.equal(ownsResource({uid:'qa'},{userId:'qa'}),true);
 assert.equal(managesEvent({uid:'a',role:'organiser',organizationId:'org-a'},{createdBy:'b',organizationId:'org-b'}),false);
 assert.equal(managesEvent({uid:'a',role:'user',organizationId:'org-a'},{createdBy:'a',organizationId:'org-a'}),false);
 assert.equal(managesEvent({uid:'a',role:'organiser',organizationId:'org-a'},{organizationId:'org-a'}),true);
});

test('QA certificate PDF exports real PDF bytes',async()=>{
 const {generateCertificatePDF}=await import('../../lib/certificates.js');
 const pdf=generateCertificatePDF({id:'qa-cert',certificateId:'qa-cert',buyerName:'QA Attendee',eventTitle:'QA Event'});
 assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
});
test('QA persisted virtual fields and local time respect IANA timezone',async()=>{
 const {verifyWebinarAccess,getSubEventStart}=await import('../../lib/webinars.js');
 const sub={id:'qa-online',isVirtual:true,virtualMeetingUrl:'https://example.invalid/meeting',virtualMeetingPasscode:'qa-pass',date:'2027-03-15',startTime:'10:10 AM',timezone:'Asia/Kolkata'};
 assert.equal(getSubEventStart(sub).toISOString(),'2027-03-15T04:40:00.000Z');
 const ticket={status:'Valid',entitledSubEventIds:['qa-online']};
 assert.equal(verifyWebinarAccess({ticket,subEvent:sub,currentTime:new Date('2027-03-15T04:24:59Z')}).authorized,false);
 const inside=verifyWebinarAccess({ticket,subEvent:sub,currentTime:new Date('2027-03-15T04:25:00Z')});
 assert.equal(inside.authorized,true);assert.equal(inside.meetingUrl,sub.virtualMeetingUrl);assert.equal(inside.meetingPasscode,'qa-pass');
 assert.equal(getSubEventStart({...sub,timezone:'America/New_York'}).toISOString(),'2027-03-15T14:10:00.000Z');
 assert.equal(getSubEventStart({...sub,timezone:'UTC'}).toISOString(),'2027-03-15T10:10:00.000Z');
 assert.equal(Number.isNaN(getSubEventStart({...sub,startTime:'25:99'}).getTime()),true);
});
