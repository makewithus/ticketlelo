const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.join(process.env.QA_TOOLS_PATH || '/tmp/ticketlelo-qa-tools', 'package.json'));
const { initializeTestEnvironment } = req('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc } = req('firebase/firestore');
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-ticketlelo-qa', firestore: { host: '127.0.0.1', port: 8187, rules: fs.readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore(); // Disposable demo project only; never use this runner against another host.
  const results = [];
  async function denied(name, operation) {
    try { await operation(); results.push({ name, pass: false, actual: 'ALLOWED; expected permission-denied' }); }
    catch (e) { results.push({ name, pass: e.code === 'permission-denied', actual: e.code || e.message }); }
  }
  try {
    await env.withSecurityRulesDisabled(async c => {
      const db = c.firestore();
      await setDoc(doc(db,'users','qa-organiser-a'), { role:'organiser', organizationId:'org-a' });
      await setDoc(doc(db,'users','qa-attendee'), { role:'user', isAdmin:false });
      await setDoc(doc(db,'users','qa-other-attendee'), { role:'user', email:'private@example.invalid', bankAccount:'synthetic-only' });
      await setDoc(doc(db,'events','qa-event-b'), { createdBy:'qa-organiser-b', organizationId:'org-b', isPublished:false, visibility:'private', title:'QA private' });
      await setDoc(doc(db,'subEvents','qa-webinar'), { parentEventId:'qa-event-b', meetingUrl:'https://example.invalid/private-qa-meeting', meetingPasscode:'synthetic-only' });
      await setDoc(doc(db,'certificates','qa-cert'), { buyerEmail:'synthetic@example.invalid', buyerName:'QA Attendee', status:'valid' });
      await setDoc(doc(db,'tickets','qa-ticket'), { userId:'qa-other', buyerEmail:'other@example.invalid', status:'Valid' });
    });
    const attacker = env.authenticatedContext('qa-new', { email:'new@example.invalid' }).firestore();
    const attendee = env.authenticatedContext('qa-attendee', { email:'attendee@example.invalid' }).firestore();
    const organiser = env.authenticatedContext('qa-organiser-a', { email:'a@example.invalid' }).firestore();
    const anon = env.unauthenticatedContext().firestore();
    await denied('RULE-01 self signup cannot set isAdmin with role user', () => setDoc(doc(attacker,'users','qa-new'), {role:'user', isAdmin:true}));
    await denied('RULE-02 self signup cannot choose organizationId', () => setDoc(doc(attendee,'users','qa-org-spoof'), {role:'user', organizationId:'org-b'}));
    // Use the matching UID to exercise create policy, rather than an unrelated path.
    const spoof = env.authenticatedContext('qa-spoof', {email:'spoof@example.invalid'}).firestore();
    await denied('RULE-03 self signup cannot choose organizationId on own path', () => setDoc(doc(spoof,'users','qa-spoof'), {role:'user', organizationId:'org-b'}));
    await denied('RULE-04 organiser A cannot mutate event B', () => updateDoc(doc(organiser,'events','qa-event-b'), {title:'Unauthorized mutation'}));
    await denied('RULE-05 anonymous cannot read webinar credentials', () => getDoc(doc(anon,'subEvents','qa-webinar')));
    await denied('RULE-06 anonymous cannot read certificate buyer email', () => getDoc(doc(anon,'certificates','qa-cert')));
    await denied('RULE-07 attendee cannot forge a used paid registration', () => setDoc(doc(attendee,'registrations','qa-forged'), {userId:'qa-attendee', status:'Used', paymentStatus:'paid', entitledSubEventIds:['qa-webinar']}));
    await denied('RULE-08 attendee cannot update protected role', () => updateDoc(doc(attendee,'users','qa-attendee'), {role:'superAdmin'}));
    await denied('RULE-09 attendee cannot read another ticket', () => getDoc(doc(attendee,'tickets','qa-ticket')));
    await denied('RULE-10 attendee cannot issue ticket directly', () => setDoc(doc(attendee,'tickets','qa-forged'), {userId:'qa-attendee',status:'Valid'}));
    await denied('RULE-13 attendee cannot read another private profile', () => getDoc(doc(attendee,'users','qa-other-attendee')));
    await denied('RULE-14 organizer cannot enumerate attendee profiles', () => getDoc(doc(organiser,'users','qa-other-attendee')));
    await denied('RULE-15 attendee cannot mint a free ticket ID or QR payload', () => setDoc(doc(attendee,'registrations','qa-fake-free-ticket'), {userId:'qa-attendee', eventId:'qa-event', fullName:'Attendee', email:'attendee@example.invalid', status:'Unused', paymentStatus:'free', ticketId:'FORGED', qrCode:'FORGED'}));
    const bootstrap = env.authenticatedContext('qa-email-only', {email:'superadmin@ticketlelo.com'}).firestore();
    await denied('RULE-11 email alone cannot grant superadmin authority', () => setDoc(doc(bootstrap,'plans','qa-email-only'), {price:0}));
    await env.withSecurityRulesDisabled(async c => {
      await setDoc(doc(c.firestore(),'users','qa-own-organiser'),{role:'organiser'});
    });
    const own=env.authenticatedContext('qa-own-organiser',{email:'own@example.invalid'}).firestore();
    try {
      await setDoc(doc(own,'events','qa-own-event'),{title:'QA Own',createdBy:'qa-own-organiser',isPublished:false});
      await updateDoc(doc(own,'events','qa-own-event'),{title:'QA Own Updated'});
      results.push({name:'RULE-12 legitimate event owner can create and edit',pass:true,actual:'allowed'});
    }catch(e){results.push({name:'RULE-12 legitimate event owner can create and edit',pass:false,actual:e.code});}
    console.log(JSON.stringify(results,null,2));
    if (process.env.QA_RESULT_FILE) fs.writeFileSync(process.env.QA_RESULT_FILE,JSON.stringify(results,null,2));
    process.exitCode = results.every(r=>r.pass) ? 0 : 1;
  } finally { await env.cleanup(); }
})().catch(e=>{ console.error(e.message); process.exitCode=1; });
