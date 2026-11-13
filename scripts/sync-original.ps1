$ErrorActionPreference = 'Stop'
# Python deployment validates hashes and preserves credentials/database files.
& python (Join-Path $PSScriptRoot 'deploy-python.py') --target 'D:\Jewellery\Jewellery' --apply
if ($LASTEXITCODE -ne 0) { throw 'Python project sync failed; no unchecked overwrite is allowed.' }
