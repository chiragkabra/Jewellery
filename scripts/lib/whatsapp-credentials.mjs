export function parseWhatsAppCredentials(raw) {
  const values={};
  for(const line of raw.split(/\r?\n/)){
    const match=line.trim().match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(match && /^(WHATSAPP_|META_APP_SECRET$)/.test(match[1]))values[match[1]]=match[2].replace(/^(["'])(.*)\1$/,'$2');
  }
  const url=raw.match(/https:\/\/graph\.facebook\.com\/(v\d+\.\d+)\/(\d+)\/messages/);
  const tokens=[...raw.matchAll(/\b(EAA[A-Za-z0-9_-]{30,})/g)].map(match=>match[1]);
  if(url){values.WHATSAPP_GRAPH_VERSION ||= url[1];values.WHATSAPP_PHONE_NUMBER_ID ||= url[2];}
  if(tokens.length)values.WHATSAPP_ACCESS_TOKEN ||= tokens.at(-1);
  values.WHATSAPP_APP_SECRET ||= values.META_APP_SECRET || '';
  let template=null;
  const data=raw.match(/-d\s+'([\s\S]*?)'/);
  if(data){try{const payload=JSON.parse(data[1].replace(/\\"/g,'"'));if(payload.template?.name)template={name:payload.template.name,language:payload.template.language?.code||'en',parameterCount:payload.template.components?.find(c=>c.type==='body')?.parameters?.length||0};}catch{}}
  return {values,template};
}
export const credentialKeys=['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_VERSION','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_TEST_RECIPIENT','WHATSAPP_BUSINESS_ACCOUNT_ID'];
