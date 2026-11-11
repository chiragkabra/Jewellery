import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseWhatsAppCredentials,credentialKeys } from './lib/whatsapp-credentials.mjs';
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const credentialFile=arg('--credentials');if(!credentialFile)throw new Error('Use --credentials <private file> [--project <project folder>]');
const root=path.resolve(arg('--project')||process.cwd()),envFile=path.join(root,'.env.local');
const {values,template}=parseWhatsAppCredentials(readFileSync(credentialFile,'utf8'));
if(!values.WHATSAPP_ACCESS_TOKEN||!/^\d+$/.test(values.WHATSAPP_PHONE_NUMBER_ID||'')||!/^v\d+\.\d+$/.test(values.WHATSAPP_GRAPH_VERSION||''))throw new Error('Credentials must contain a token, phone number ID and version.');
let content=existsSync(envFile)?readFileSync(envFile,'utf8'):'';
const existing={};for(const line of content.split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)existing[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}
const updates={WHATSAPP_MODE:'preview'};
for(const key of credentialKeys)if(values[key])updates[key]=values[key];
if(!existing.WHATSAPP_VERIFY_TOKEN&&!updates.WHATSAPP_VERIFY_TOKEN)updates.WHATSAPP_VERIFY_TOKEN=randomBytes(24).toString('hex');
if(!existing.WHATSAPP_CRON_SECRET)updates.WHATSAPP_CRON_SECRET=randomBytes(32).toString('hex');
if(values.WHATSAPP_TEST_RECIPIENT)updates.WHATSAPP_ALLOWED_RECIPIENTS=values.WHATSAPP_TEST_RECIPIENT.replace(/\D/g,'');
for(const [key,value]of Object.entries(updates)){
 if(/[\r\n]/.test(value))throw new Error('Unexpected newline in credential value');
 const line=`${key}=${value}`;const pattern=new RegExp(`^${key}=.*$`,'m');content=pattern.test(content)?content.replace(pattern,()=>line):content.replace(/\s*$/,'')+'\n'+line+'\n';
}
mkdirSync(root,{recursive:true});writeFileSync(envFile,content,{mode:0o600});
const merged={...existing,...updates};const database=path.resolve(root,merged.DATABASE_PATH||'data/lumera.sqlite');
if(template && /^[a-z][a-z0-9_]{0,127}$/.test(template.name) && template.parameterCount===3 && existsSync(database)){
 const db=new DatabaseSync(database,{timeout:5000});db.exec('CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY,data TEXT NOT NULL,created_at TEXT NOT NULL)');db.exec('BEGIN IMMEDIATE');
 try{
  const row=db.prepare("SELECT data FROM settings WHERE id='whatsapp'").get();const settings=row?JSON.parse(row.data):{};
  settings.enabled=false;settings.templates={...settings.templates,purchase_confirmed:{name:template.name,language:template.language,approved:false}};
  settings.importedTemplate={name:template.name,language:template.language,parameterOrder:['customer name','order reference','purchase date'],providerApprovalVerified:false};
  db.prepare("INSERT INTO settings VALUES('whatsapp',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(JSON.stringify(settings),new Date().toISOString());
  if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit'").get())db.prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(randomBytes(16).toString('hex'),'local-cli','whatsapp.credentials.imported','settings',new Date().toISOString());
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw new Error('Environment imported, but template mapping could not be saved. No messages sent.');}finally{db.close();}
}
console.log(JSON.stringify({imported:true,mode:'preview',savedKeys:Object.keys(updates),purchaseTemplate:template?.name||null,templateApproval:'must be verified in Meta',appSecretConfigured:!!merged.WHATSAPP_APP_SECRET,recipientRestriction:!!updates.WHATSAPP_ALLOWED_RECIPIENTS,secretsPrinted:false},null,2));


