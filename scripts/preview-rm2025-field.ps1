param([int]$Port = 4336)
$ErrorActionPreference = 'Stop'
$fieldPreviewRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'materials/models/derived/rm2025-field'
if (-not (Test-Path -LiteralPath (Join-Path $fieldPreviewRoot 'manifest.json'))) {
  throw 'The field asset manifest has not been generated.'
}
Write-Host "Open http://127.0.0.1:$Port/preview.html"
python -m http.server $Port --bind 127.0.0.1 --directory $fieldPreviewRoot
