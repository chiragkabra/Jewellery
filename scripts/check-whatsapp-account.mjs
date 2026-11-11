import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { parseWhatsAppCredentials } from './lib/whatsapp-credentials.mjs';
const args=process.argv.slice(2),index=args.indexOf('--credentials');
const source=index>=0 ? parseWhatsAppCredentials(readFileSync(args[index+1],'utf8')) : {values:process.env,template:null};
const {WHATSAPP_ACCESS_TOKEN:token,WHATSAPP_PHONE_NUMBER_ID:phone,WHATSAPP_GRAPH_VERSION:version}=source.values;
if(!token||!/^\d+$/.test(phone||'')||!/^v\d+\.\d+$/.test(version||''))throw new Error('Valid token, phone number ID and Graph version are required.');
let report;
try{
 const response=await fetch(`https://graph.facebook.com/${version}/${phone}?fields=id,verified_name,display_phone_number`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
 const result=await response.json();
 report={checkedAt:new Date().toISOString(),httpStatus:response.status,connected:response.ok,graphVersion:version,template:source.template,errorCode:result.error?.code||null,errorSubcode:result.error?.error_subcode||null,reason:response.ok?'Phone account access verified':result.error?.code===190?'Access token invalid or expired':'Provider rejected account lookup',businessName:response.ok?result.verified_name||null:null,phoneSuffix:response.ok?String(result.display_phone_number||'').replace(/\D/g,'').slice(-4):null,appSecretProvided:!!source.values.WHATSAPP_APP_SECRET,wabaIdProvided:!!source.values.WHATSAPP_BUSINESS_ACCOUNT_ID};
}catch(error){report={checkedAt:new Date().toISOString(),connected:false,networkFailure:true,reason:'Account lookup could not reach Meta. No messages sent.'};mkdirSync('test-results',{recursive:true});writeFileSync('test-results/whatsapp-account-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=2;}
if(report && !report.networkFailure){mkdirSync('test-results',{recursive:true});writeFileSync('test-results/whatsapp-account-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
