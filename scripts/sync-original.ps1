$ErrorActionPreference = 'Stop'
$workspace = 'C:\Users\ADMIN\Documents\ChatGPT\jewellery'
$destination = 'D:\Jewellery\Jewellery'
if ([IO.Path]::GetFullPath($destination) -ne 'D:\Jewellery\Jewellery') { throw 'Unexpected destination' }
if (!(Test-Path -LiteralPath (Join-Path $destination 'package.json'))) { throw 'Original project not found' }
$changes = git -c safe.directory=D:/Jewellery/Jewellery -C $destination status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Could not verify original repository status' }
if ($changes) { throw 'Original repository changed since review. Sync stopped to preserve edits.' }
foreach ($folder in @('src','scripts','docs','artifacts')) {
  Copy-Item -LiteralPath (Join-Path $workspace $folder) -Destination $destination -Recurse -Force
}
foreach ($file in @('package.json','package-lock.json','README.md','.gitignore','.env.example','next.config.mjs','tsconfig.json','tailwind.config.ts','postcss.config.mjs','next-env.d.ts')) {
  Copy-Item -LiteralPath (Join-Path $workspace $file) -Destination (Join-Path $destination $file) -Force
}
if (!(Test-Path -LiteralPath (Join-Path $destination '.env.local'))) {
  Copy-Item -LiteralPath (Join-Path $workspace '.env.local') -Destination (Join-Path $destination '.env.local')
}
$database = Join-Path $destination 'data\lumera.sqlite'
if (!(Test-Path -LiteralPath $database)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $destination 'data') | Out-Null
  Copy-Item -LiteralPath (Join-Path $workspace 'backups\deployment-seed.sqlite') -Destination $database
  Copy-Item -LiteralPath (Join-Path $workspace 'SETUP.local.md') -Destination (Join-Path $destination 'SETUP.local.md')
}
New-Item -ItemType Directory -Force -Path (Join-Path $destination 'backups') | Out-Null
Copy-Item -LiteralPath (Join-Path $workspace 'backups\original-project-before-backend.zip') -Destination (Join-Path $destination 'backups\original-project-before-backend.zip') -Force
Set-Location -LiteralPath $destination
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
Write-Output 'Verified backend and CRM synced to D:\Jewellery\Jewellery'
