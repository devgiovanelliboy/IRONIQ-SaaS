# ============================================================
#  IRONIQ — Deploy automático
#  Bumpa a versão do Service Worker (cache-busting) e publica.
#  Uso:  .\deploy.ps1            (deploy do hosting)
#        .\deploy.ps1 -Rules     (deploy do hosting + regras do Firestore)
# ============================================================
param(
  [switch]$Rules
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$swPath = Join-Path $root 'public\sw.js'

# 1) Lê o sw.js e incrementa a versão do cache (ironiq-vN -> ironiq-v(N+1))
$sw = Get-Content $swPath -Raw
$m = [regex]::Match($sw, "var CACHE = 'ironiq-v(\d+)';")
if (-not $m.Success) {
  Write-Host "❌ Não encontrei a linha 'var CACHE = ironiq-vN' em sw.js" -ForegroundColor Red
  exit 1
}
$atual = [int]$m.Groups[1].Value
$novo  = $atual + 1
$sw = $sw -replace "var CACHE = 'ironiq-v\d+';", "var CACHE = 'ironiq-v$novo';"
Set-Content -Path $swPath -Value $sw -Encoding UTF8 -NoNewline
Write-Host "🔁 Service Worker: ironiq-v$atual  ->  ironiq-v$novo" -ForegroundColor Cyan

# 2) Deploy
$target = if ($Rules) { 'hosting,firestore:rules' } else { 'hosting' }
Write-Host "🚀 Publicando ($target)..." -ForegroundColor Cyan
firebase deploy --only $target

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✅ Deploy concluído! Versão ironiq-v$novo no ar." -ForegroundColor Green
  Write-Host "   https://ironiq-e9f7e.web.app" -ForegroundColor Green
} else {
  Write-Host "`n❌ Deploy falhou. Revertendo a versão do Service Worker..." -ForegroundColor Red
  $sw = $sw -replace "var CACHE = 'ironiq-v\d+';", "var CACHE = 'ironiq-v$atual';"
  Set-Content -Path $swPath -Value $sw -Encoding UTF8 -NoNewline
  exit 1
}
