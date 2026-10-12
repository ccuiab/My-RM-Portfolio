param(
  [string]$InputGlb = 'D:\AI_playground\My-RM-Portfolio\materials\models\derived\inputs\codex\task3_hero_raw.glb',
  [string]$Blender = 'D:\Blender Foundation\Blender 5.1\blender.exe',
  [string]$Audit = "$env:LOCALAPPDATA\Temp\rm-shots\launcher\render-audit.json",
  [int]$Samples = 48,
  [double[]]$View = @(1.2, 2.5, 1.5)
)
$ErrorActionPreference = 'Stop'
$worktreeRoot = Split-Path -Parent $PSScriptRoot
$lockPath = 'D:\AI_playground\rm-wt\locks\heavy'
$deadline = (Get-Date).AddMinutes(40)
if ($View.Count -ne 3) { throw 'View requires three coordinates' }
while ($true) {
  try { New-Item -ItemType Directory $lockPath -ErrorAction Stop | Out-Null; break }
  catch { if ((Get-Date) -gt $deadline) { throw }; Start-Sleep -Seconds 30 }
}
$renderProcess = $null
try {
  New-Item -ItemType Directory (Split-Path -Parent $Audit) -Force | Out-Null
  $pythonScript = Join-Path $PSScriptRoot 'render-launcher-core.py'
  $renderArgs = @('--background', '--factory-startup', '--python-exit-code', '1', '--python', ('"' + $pythonScript + '"'),
    '--', '--input', ('"' + $InputGlb + '"'), '--audit', ('"' + $Audit + '"'), '--samples', $Samples,
    '--view') + @($View | ForEach-Object { $_.ToString([System.Globalization.CultureInfo]::InvariantCulture) })
  $renderProcess = Start-Process -FilePath $Blender -ArgumentList $renderArgs -WorkingDirectory $worktreeRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput ($Audit + '.stdout.log') -RedirectStandardError ($Audit + '.stderr.log')
  # Keep the Windows process handle alive so ExitCode remains available in PS 5.1.
  $processHandle = $renderProcess.Handle
  if (-not $renderProcess.WaitForExit(840000)) {
    Stop-Process -Id $renderProcess.Id -Force
    throw 'Render exceeded 14 minutes; process stopped before releasing lock'
  }
  $renderProcess.Refresh()
  if ($renderProcess.ExitCode -ne 0) { throw "Blender failed: inspect $Audit.stdout.log and $Audit.stderr.log" }
  Write-Output "Rendered launcher core; audit: $Audit"
} finally {
  if ($renderProcess -and -not $renderProcess.HasExited) { Stop-Process -Id $renderProcess.Id -Force }
  Remove-Item -LiteralPath $lockPath
}
