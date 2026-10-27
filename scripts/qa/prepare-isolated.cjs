const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const target=path.resolve(process.argv[2]||'/tmp/ticketlelo-qa-retest');
if(!target.startsWith('/tmp/ticketlelo-qa-'))throw Error('QA copy must use /tmp/ticketlelo-qa-*');
fs.mkdirSync(target,{recursive:true});
const marker=path.join(target,'.ticketlelo-qa-copy');
if(fs.existsSync(path.join(target,'.env'))&&!fs.existsSync(marker))throw Error('Refusing to overwrite an unmarked environment file');
fs.writeFileSync(marker,'Disposable TicketLelo QA source copy; no production configuration\n');
for(const entry of fs.readdirSync(root)){
 if(['.git','.next','node_modules','docs'].includes(entry)||entry.startsWith('.env'))continue;
 fs.cpSync(path.join(root,entry),path.join(target,entry),{recursive:true});
}
const modules=path.join(target,'node_modules');
if(!fs.existsSync(modules))fs.cpSync(path.join(root,'node_modules'),modules,{recursive:true});
const safe=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/2026-10-25/safe-environment.json'),'utf8'));
fs.writeFileSync(path.join(target,'.env'),Object.entries(safe).map(([k,v])=>k+'='+v).join('\n')+'\n');
console.log('Prepared isolated source, copied dependencies and dummy .env at '+target);
