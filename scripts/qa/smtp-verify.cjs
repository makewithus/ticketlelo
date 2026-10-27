const fs=require('node:fs');
const nodemailer=require('nodemailer');
process.loadEnvFile('.env');
(async()=>{
 const user=process.env.SMTP_USER||process.env.SMTP_EMAIL,pass=process.env.SMTP_PASS||process.env.SMTP_PASSWORD;
 if(!user||!pass)throw Error('SMTP credentials unavailable');
 const transport=nodemailer.createTransport({...(process.env.SMTP_HOST?{host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465}:{service:'gmail'}),auth:{user,pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000,logger:false,debug:false});
 let result;
 try{await transport.verify();result={integration:'SMTP connection and authentication only',pass:true,scope:'No email sent; recipient delivery and ticket attachments remain unverified'};}
 catch(e){result={integration:'SMTP connection and authentication only',pass:false,errorCode:e.code||e.name,command:e.command,scope:'No email sent; credentials and provider response text suppressed'};}
 finally{transport.close();}
 fs.writeFileSync('docs/qa/2026-10-25/evidence/smtp-verify.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.pass?0:1;
})().catch(e=>{console.error(JSON.stringify({pass:false,error:e.name,message:'SMTP verification unavailable; values suppressed'}));process.exitCode=1;});
