"""Check an online copy of the original database; never mutate the original."""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.core import connect, initialize, database, one
from dotenv import dotenv_values


def snapshot(db):
    result={}
    for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        rows=db.execute(f'SELECT * FROM "{name}" ORDER BY rowid').fetchall()
        encoded=json.dumps([[v.hex() if isinstance(v,bytes) else v for v in row] for row in rows],ensure_ascii=False,separators=(',',':'))
        result[name]={'rows':len(rows),'digest':hashlib.sha256(encoded.encode()).hexdigest()}
    return result


def main():
    project=Path(sys.argv[1]).resolve()
    env=dotenv_values(project/'.env.local')
    path=Path(env.get('DATABASE_PATH') or 'data/lumera.sqlite')
    if not path.is_absolute():path=project/path
    with tempfile.TemporaryDirectory(prefix='lumera-migration-check-') as folder:
        source=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True)
        copy=sqlite3.connect(Path(folder)/'copy.sqlite')
        source.backup(copy);copy.close();source.close()
        db=connect(Path(folder)/'copy.sqlite')
        before=snapshot(db);initialize(db);after=snapshot(db)
        assert before==after,'Python initialization changed existing data'
        with database(db):
            assert one('PRAGMA integrity_check')['integrity_check']=='ok'
            assert not db.execute('PRAGMA foreign_key_check').fetchall()
        db.close()
        result={'ok':True,'originalWasReadOnly':True,'unchangedTables':len(before),'counts':{name:value['rows'] for name,value in before.items()}}
        report=ROOT/'test-results/python-migration.json';report.parent.mkdir(exist_ok=True);report.write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result))


if __name__=='__main__':main()
