// Starts the frontend and Python backend together; all business work runs in Python.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const args=process.argv.slice(2),command=args.shift()||"dev";
if(!["dev","start"].includes(command))throw new Error("Use dev or start");
const port=process.env.PYTHON_BACKEND_PORT||"8000";
const env={...process.env,PYTHON_BACKEND_URL:process.env.PYTHON_BACKEND_URL||`http://127.0.0.1:${port}`,...(command==="start"?{NODE_ENV:"production"}:{})};
const children=[];let stopped=false;
function stop(code=0){if(stopped)return;stopped=true;for(const child of children)child.kill();process.exitCode=code;}
function launch(binary,args){const child=spawn(binary,args,{env,stdio:"inherit",windowsHide:true});children.push(child);child.on("error",error=>{console.error(error.message);stop(1);});child.on("exit",code=>{if(!stopped)stop(code||1);});return child;}
process.on("SIGINT",()=>stop());process.on("SIGTERM",()=>stop());
const localPython=path.resolve(process.platform==="win32"?".venv/Scripts/python.exe":".venv/bin/python");
launch(process.env.PYTHON_EXECUTABLE||(existsSync(localPython)?localPython:"python"),["-m","backend","serve","--port",port]);
let ready=false;
for(let i=0;i<120&&!stopped;i++){try{const r=await fetch(`${env.PYTHON_BACKEND_URL}/api/health`,{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).backend==="python"){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(!ready){console.error("Python backend did not start. Run: python -m pip install -r backend/requirements.txt");stop(1);}else launch(process.execPath,["node_modules/next/dist/bin/next",command,...args]);
