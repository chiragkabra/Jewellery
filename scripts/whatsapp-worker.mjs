const url=new URL("/api/whatsapp/run",process.env.WHATSAPP_WORKER_URL||process.env.APP_URL||"http://localhost:3000");
const secret=process.env.WHATSAPP_CRON_SECRET;
if(!secret||secret.length<32){console.error("Set WHATSAPP_CRON_SECRET to 32+ characters before running the worker.");process.exit(1);}
const watch=process.argv.includes("--watch");let stopping=false;let failures=0;
process.on("SIGTERM",()=>{stopping=true;});process.on("SIGINT",()=>{stopping=true;});
async function tick(){try{const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`Worker endpoint HTTP ${response.status}`);const result=await response.json();failures=0;if(!watch||result.sent||result.failed||result.uncertain)console.log("WhatsApp queue:",JSON.stringify(result));}catch(error){failures++;if(!watch||failures===3||failures%10===0)console.error("WhatsApp worker:",error.message);if(!watch)process.exitCode=1;}}
if(watch)console.log("WhatsApp scheduling enabled: checking due messages every 60 seconds. Preview records are never sent.");
do{await tick();if(!watch||stopping)break;await new Promise(resolve=>{const timer=setTimeout(resolve,60000);const stop=()=>{clearTimeout(timer);resolve();};process.once("SIGINT",stop);process.once("SIGTERM",stop);setTimeout(()=>{process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);},60001).unref();});}while(!stopping);

