const fs=require('node:fs');
const assert=require('node:assert/strict');
const dir='docs/qa/2026-10-25/';
const rows=JSON.parse(fs.readFileSync(dir+'requirements.json'));
const summary=JSON.parse(fs.readFileSync(dir+'summary.json'));
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
assert.equal(rows.length,summary.total);
assert.equal(rows.filter(r=>r.code!=='A').length,summary.applicable);
for(const [status,count] of Object.entries(summary.status))assert.equal(rows.filter(r=>r.status===status).length,count);
for(const r of rows){assert(r.expected&&r.frontend&&r.api_service&&r.model&&r.test&&r.evidence);if(r.code==='R')assert(r.defect);}
for(const name of ['QA_FINAL_ACCEPTANCE_REPORT','QA_REQUIREMENTS_TRACEABILITY','QA_TEST_CASES','QA_DEFECT_LOG','QA_INTEGRATION_MATRIX','QA_SECURITY_RELIABILITY_REPORT','QA_E2E_RESULTS','QA_TEST_HANDOVER'])assert(fs.statSync(dir+name+'.md').size>0);
console.log(JSON.stringify({pass:true,total:rows.length,applicable:summary.applicable,status:summary.status,reportFiles:8},null,2));
