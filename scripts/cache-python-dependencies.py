"""Create local offline wheels from this machine's already installed dependencies.

Useful when PyPI is unavailable. Does not modify the global interpreter. Only
files owned by the selected distributions inside site-packages are packaged.
"""
import base64
import csv
import hashlib
import importlib.metadata as metadata
import io
from pathlib import Path
import re
import zipfile
from packaging.requirements import Requirement
from packaging.tags import parse_tag,sys_tags

ROOT=Path(__file__).resolve().parents[1]


def main():
    wheelhouse=ROOT/'backups/python-wheelhouse';wheelhouse.mkdir(parents=True,exist_ok=True)
    requested=['fastapi','uvicorn','httpx','python-multipart','python-dotenv','pytest','pytest-cov']
    selected={}
    pending=[(name,set()) for name in requested]
    while pending:
        name,extras=pending.pop()
        normalized=re.sub(r'[-_.]+','-',name).lower()
        if normalized in selected:continue
        dist=metadata.distribution(name);selected[normalized]=dist
        for raw in dist.requires or []:
            req=Requirement(raw)
            if req.marker and not any(req.marker.evaluate({'extra':extra}) for extra in extras or {''}):continue
            child=metadata.distribution(req.name)
            if req.specifier and child.version not in req.specifier:raise RuntimeError('Installed dependency mismatch: '+req.name)
            pending.append((req.name,set(req.extras)))
    for name,dist in sorted(selected.items()):
        files={}
        base=Path(dist.locate_file('')).resolve()
        for entry in dist.files or []:
            path=Path(dist.locate_file(entry)).resolve()
            if not path.is_relative_to(base) or not path.is_file() or '__pycache__' in path.parts:continue
            relative=path.relative_to(base).as_posix()
            if relative.endswith('/RECORD'):continue
            files[relative]=path.read_bytes()
        wheel_path=next((key for key in files if key.endswith('.dist-info/WHEEL')),None)
        if not wheel_path:raise RuntimeError('Missing wheel metadata for '+name)
        compatible=set(sys_tags())
        tag=next(value.strip() for value in re.findall(r'^Tag: (.+)$',files[wheel_path].decode(),re.M) if parse_tag(value.strip()) & compatible)
        filename=f'{name.replace("-","_")}-{dist.version}-{tag}.whl'
        record_path=wheel_path.rsplit('/',1)[0]+'/RECORD'
        stream=io.StringIO(newline='');writer=csv.writer(stream)
        for relative,content in sorted(files.items()):
            encoded=base64.urlsafe_b64encode(hashlib.sha256(content).digest()).rstrip(b'=').decode()
            writer.writerow([relative,'sha256='+encoded,len(content)])
        writer.writerow([record_path,'','']);files[record_path]=stream.getvalue().encode()
        with zipfile.ZipFile(wheelhouse/filename,'w',zipfile.ZIP_DEFLATED) as archive:
            for relative,content in files.items():archive.writestr(relative,content)
    (ROOT/'backend/requirements-lock.txt').write_text('# Tested dependency snapshot, Python 3.11\n'+'\n'.join(f'{name}=={dist.version}' for name,dist in sorted(selected.items()))+'\n')
    print(f'Cached {len(selected)} tested distributions in {wheelhouse}')


if __name__=='__main__':main()
