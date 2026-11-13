// Use an isolated project interpreter when available.
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
const local=path.resolve(process.platform==="win32"?".venv/Scripts/python.exe":".venv/bin/python");
const executable=process.env.PYTHON_EXECUTABLE||(existsSync(local)?local:"python");
const child=spawn(executable,process.argv.slice(2),{stdio:"inherit",env:process.env,windowsHide:true});
child.on("error",error=>{console.error(error.message);process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
process.on("SIGINT",()=>child.kill());process.on("SIGTERM",()=>child.kill());
