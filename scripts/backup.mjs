import { DatabaseSync,backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
const filename=path.resolve(process.env.DATABASE_PATH || "data/lumera.sqlite");
const output=path.resolve(process.argv[2] || `backups/lumera-${new Date().toISOString().replace(/[:.]/g,"-")}.sqlite`);
if(filename===output) throw new Error("Backup destination must differ from source");
mkdirSync(path.dirname(output),{recursive:true});const db=new DatabaseSync(filename,{readOnly:true});
await backup(db,output);db.close();console.log(`Database backup saved: ${output}`);
