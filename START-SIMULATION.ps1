$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Start-Process 'http://127.0.0.1:8787/advanced/'
node server.mjs
