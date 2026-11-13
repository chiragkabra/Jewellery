"""Install the verified rewrite into the original project, preserving private data.

Run from the working copy. Refuses concurrent edits to any replaced legacy file.
Only source paths in this manifest are copied/removed; never credentials or .git.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import zipfile

SOURCE=Path(__file__).resolve().parents[1]
CHANGED=['.env.example','.gitignore','README.md','package.json','package-lock.json','next.config.mjs','src/app/crm/page.tsx','src/app/product/[slug]/page.tsx','src/app/collections/[material]/page.tsx','docs/API.md','docs/AUTOMATION-CENTER.md','docs/WHATSAPP.md','docs/PURCHASE-AUTOMATION.md','docs/PROJECT-REVIEW.md','scripts/sync-original.ps1']
OLD_SCRIPTS=['create-admin.mjs','backup.mjs','whatsapp-worker.mjs','with-whatsapp-worker.mjs','test-backend.mjs','test-whatsapp.mjs','test-automations.mjs','check-whatsapp-account.mjs','import-whatsapp-credentials.mjs','lib/whatsapp-credentials.mjs']
NEW=['pyproject.toml','src/lib/server/python.ts','src/app/api/[...path]/route.ts','scripts/run-project.mjs','scripts/python.mjs','scripts/test-project.py','scripts/verify-python-migration.py','scripts/cache-python-dependencies.py','scripts/deploy-python.py','docs/PYTHON-BACKEND.md','docs/PYTHON-TEST-REPORT.md']


def digest(content):return hashlib.sha256(content).hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--target',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    target=Path(args.target).resolve()
    if target==SOURCE or not (target/'package.json').is_file():raise SystemExit('Choose the original project root')
    baseline=zipfile.ZipFile(SOURCE/'backups/before-python-rewrite.zip')
    old={name:baseline.read(name) for name in baseline.namelist() if not name.endswith('/')}
    receipt_path=target/'backups/python-sync-receipt.json'
    receipt=json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    removed=[name for name in old if name.startswith('src/lib/server/') or name.startswith('src/app/api/') or name in ['scripts/'+s for s in OLD_SCRIPTS]]
    removed=[name for name in removed if name not in NEW]
    changed=[name for name in CHANGED if (SOURCE/name).is_file()]
    mismatches=[]
    for name in set(changed+removed):
        path=target/name
        if name in removed and not path.exists():continue
        if path.is_file() and receipt.get(name)==digest(path.read_bytes()):continue
        if name in old and (not path.is_file() or digest(path.read_bytes())!=digest(old[name])):
            # A prior successful application is safe to repeat.
            if not (name in changed and path.is_file() and digest(path.read_bytes())==digest((SOURCE/name).read_bytes())):
                mismatches.append(name)
    new=NEW+[p.relative_to(SOURCE).as_posix() for p in (SOURCE/'backend').rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix in ('.py','.sql','.json','.txt')]
    for name in new:
        path=target/name
        if path.exists() and name not in old and digest(path.read_bytes()) not in (digest((SOURCE/name).read_bytes()),receipt.get(name)):mismatches.append(name)
    if mismatches:raise SystemExit('Concurrent/unexpected source edits; not overwritten: '+', '.join(sorted(set(mismatches))))
    print(json.dumps({'changed':len(changed),'new':len(new),'retired':len(removed),'conflicts':[]}))
    if not args.apply:return
    backups=target/'backups';backups.mkdir(exist_ok=True)
    if not (backups/'before-python-rewrite.zip').exists():shutil.copy2(SOURCE/'backups/before-python-rewrite.zip',backups/'before-python-rewrite.zip')
    from dotenv import dotenv_values
    env=dotenv_values(target/'.env.local')
    database=Path(env.get('DATABASE_PATH') or 'data/lumera.sqlite')
    if not database.is_absolute():database=target/database
    if database.exists() and not (backups/'before-python-rewrite.sqlite').exists():
        source_db=sqlite3.connect(database.resolve().as_uri()+'?mode=ro',uri=True)
        try:
            with sqlite3.connect(backups/'before-python-rewrite.sqlite') as output:source_db.backup(output)
        finally:source_db.close()
    for name in sorted(set(changed+new)):
        destination=(target/name).resolve()
        if not destination.is_relative_to(target):raise SystemExit('Outside target')
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(SOURCE/name,destination)
    for name in removed:
        destination=(target/name).resolve()
        if not destination.is_relative_to(target):raise SystemExit('Outside target')
        if destination.is_file():destination.unlink()
    different=[name for name in changed+new if digest((SOURCE/name).read_bytes())!=digest((target/name).read_bytes())]
    if different:raise SystemExit('Sync verification failed: '+', '.join(different))
    receipt_path.write_text(json.dumps({name:digest((target/name).read_bytes()) for name in set(changed+new)},indent=2)+'\n')
    print(json.dumps({'synced':len(set(changed+new)),'retired':len(removed),'hashDifferences':different,'credentialsAndDataPreserved':True}))


if __name__=='__main__':main()
