import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const args=process.argv.slice(2),command=args.shift()||"dev";
const env={...process.env,WHATSAPP_CRON_SECRET:process.env.WHATSAPP_CRON_SECRET||randomBytes(32).toString("hex")};
if(!["dev","start"].includes(command))throw new Error("Use dev or start");
const next=spawn(process.execPath,["node_modules/next/dist/bin/next",command,...args],{env,stdio:"inherit",windowsHide:true});
const worker=process.env.WHATSAPP_WORKER_ENABLED === "false"?null:spawn(process.execPath,["scripts/whatsapp-worker.mjs","--watch"],{env,stdio:"inherit",windowsHide:true});
function stop(){worker?.kill();next.kill();}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
next.on("exit",code=>{worker?.kill();process.exitCode=code||0;});
next.on("error",error=>{console.error(error.message);stop();process.exitCode=1;});
worker?.on("error",error=>console.error("WhatsApp worker could not start:",error.message));
