param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../materials/documents/derived/audits/swimg/captures'),
  [switch]$WaitForMemory
)
$ErrorActionPreference = 'Stop'
$sources = @(
  'D:\RM2025\New_Hero_gimbal_2.0\Main_assembly\发机_4310pitch.SLDASM',
  'D:\RM2025\【RM2025-轮式六轴机械臂工程机械结构开源】香港科技大学-ENTERPRIZE\chassis\3508_3508舵轮模组\3508_3508_Swerve_drive_v2.2025.10.1.SLDASM'
)
$roots = @(
  'D:\RM2025\New_Hero_gimbal_2.0',
  'D:\RM2025\【RM2025-轮式六轴机械臂工程机械结构开源】香港科技大学-ENTERPRIZE'
)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (Get-Process SLDWORKS -ErrorAction SilentlyContinue) {
  throw 'Existing SolidWorks process detected; do not attach, modify or terminate it.'
}
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$files = @(foreach ($root in $roots) {
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
    [pscustomobject][ordered]@{ path=$_.FullName; bytes=$_.Length; modifiedUtc=$_.LastWriteTimeUtc.ToString('o') }
  }
})
$hashes = @(foreach ($source in $sources) {
  $item = Get-Item -LiteralPath $source
  [ordered]@{ path=$source; bytes=$item.Length; sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash }
})
$snapshot = [ordered]@{
  utc=(Get-Date).ToUniversalTime().ToString('o')
  roots=$roots
  fileCount=$files.Count
  totalBytes=($files | Measure-Object -Property bytes -Sum).Sum
  files=$files
  topLevelAssemblies=$hashes
  note='Metadata snapshot only; only the two top-level assemblies are hashed. No SolidWorks application or documents opened.'
}
$snapshot | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\source-$stamp.json"
Write-Output "Source snapshot: $OutputDirectory\source-$stamp.json ($($files.Count) files)"
if (-not $WaitForMemory) { return }

$lockPath = (Join-Path $PSScriptRoot '../tmp/locks/heavy')
$lockDeadline = (Get-Date).AddMinutes(40)
$ownsLock = $false
try {
  while (-not $ownsLock) {
    try {
      New-Item -ItemType Directory -Path $lockPath -ErrorAction Stop | Out-Null
      $ownsLock = $true
    } catch {
      if (-not (Test-Path -LiteralPath $lockPath -PathType Container)) { throw }
      if ((Get-Date) -ge $lockDeadline) { throw 'Heavy operation lock wait exceeded 40 minutes.' }
      Write-Output 'Waiting for heavy operation lock.'
      Start-Sleep -Seconds 30
    }
  }
  $memoryDeadline = (Get-Date).AddMinutes(10)
  $samples = @()
  while ($true) {
    $available = [int](Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
    $samples += [ordered]@{ utc=(Get-Date).ToUniversalTime().ToString('o'); availableMB=$available }
    $samples | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\memory-$stamp.json"
    Write-Output "Available memory: $available MB"
    if ($available -ge 2000) { Write-Output 'Preflight memory gate passed. Capture must reacquire the lock and recheck immediately before starting SW.'; break }
    if ((Get-Date) -ge $memoryDeadline) { throw 'Available memory remained below 2000 MB for 10 minutes. Stop; do not launch SolidWorks.' }
    Start-Sleep -Seconds 30
  }
} finally {
  if ($ownsLock) { Remove-Item -LiteralPath $lockPath }
}
