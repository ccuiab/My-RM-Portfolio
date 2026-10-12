param(
  [ValidateSet('launcher','swerve')][string]$Asset = 'launcher',
  [int]$Size = 1200,
  [string]$ViewMatrix = '',
  [switch]$ProbeOnly,
  [string]$OutputDirectory = 'D:\AI_playground\rm-wt\shared-inputs\swimg',
  [switch]$Worker,
  [string]$GuardToken = ''
)
$ErrorActionPreference = 'Stop'
$lockPath = 'D:\AI_playground\rm-wt\locks\heavy'
$ownerPath = Join-Path $lockPath 'swimg-owner.json'
$archive = 'D:\AI_playground\My-RM-Portfolio\scripts\asset-pipeline-archive'
$source = if ($Asset -eq 'launcher') {
  'D:\RM2025\New_Hero_gimbal_2.0\Main_assembly\发机_4310pitch.SLDASM'
} else {
  'D:\RM2025\【RM2025-轮式六轴机械臂工程机械结构开源】香港科技大学-ENTERPRIZE\chassis\3508_3508舵轮模组\3508_3508_Swerve_drive_v2.2025.10.1.SLDASM'
}
if ($Size -lt 256 -or $Size -gt 6000) { throw 'Capture size must be 256..6000.' }
if (-not $ProbeOnly -and -not $ViewMatrix) { throw 'Capture requires a verified CAD-to-view 3x3 matrix. First use -ProbeOnly for component bounds and a trial view.' }
$rotation = @()
if ($ViewMatrix) {
  $rotation = @($ViewMatrix.Split(',') | ForEach-Object { [double]::Parse($_,[Globalization.CultureInfo]::InvariantCulture) })
  if ($rotation.Count -ne 9) { throw 'ViewMatrix requires nine comma-separated numbers.' }
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

if ($Worker) {
  $owner = Get-Content -Encoding UTF8 -Raw -LiteralPath $ownerPath | ConvertFrom-Json
  if (-not $GuardToken -or $owner.token -ne $GuardToken) { throw 'Worker requires the parent-owned heavy lock.' }
  if (Get-Process SLDWORKS -ErrorAction SilentlyContinue) { throw 'Existing SW process; do not attach.' }
  $interop = 'C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\api\redist'
  $references = @("$interop\SolidWorks.Interop.sldworks.dll","$interop\SolidWorks.Interop.swconst.dll",'System.Web.Extensions')
  [void][Reflection.Assembly]::LoadFrom($references[0])
  [void][Reflection.Assembly]::LoadFrom($references[1])
  Add-Type -Path "$archive\sw-probe\SwProbe.cs","$archive\codex\Task2Sw.cs","$archive\codex\Task3Sw.cs","$archive\image-refresh\sw\SwImage.cs",(Join-Path $PSScriptRoot 'render-sw-research.cs') -ReferencedAssemblies $references
  $sw = $null; $old = $null; $viewPrepared = $false
  try {
    $sw = New-Object -ComObject SldWorks.Application
    [ResearchSwCapture]::ProcessId($sw) | Set-Content -LiteralPath "$OutputDirectory\owned-sw.pid"
    $old = @{
      frame=[SwImage]::GetFrame($sw); ints=[SwImage]::GetInts($sw); doubles=[SwImage]::GetDoubles($sw)
      folders=[Task3Sw]::GetFolders($sw); search=[Task3Sw]::GetSearch($sw); readOnly=[Task2Sw]::GetRO($sw)
      global=[ResearchSwCapture]::GlobalPreferences($sw)
    }
    $old | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-preferences-before.json"
    [Task2Sw]::SetRO($sw,$true)
    [ResearchSwCapture]::DisableAutomaticWrites($sw)
    $root = if ($Asset -eq 'launcher') { 'D:\RM2025\New_Hero_gimbal_2.0' } else { Split-Path -Parent $source }
    $folders = @($root) + @(Get-ChildItem -LiteralPath $root -Directory -Recurse | Select-Object -ExpandProperty FullName)
    [void][Task3Sw]::SetFolders($sw,($folders -join ';')); [Task3Sw]::SetSearch($sw,$true)
    [SwImage]::ShowApp($sw); [SwProbe]::SetUserControlBackground($sw,$true)
    $opened = [SwProbe]::Open($sw,$source,67) | ConvertFrom-Json
    $opened | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-open.json"
    if (-not $opened.ok -or -not $opened.info.readOnly) { throw 'Source did not open read-only.' }
    [Task2Sw]::MarkAllRO($sw)
    [SwProbe]::ResolveLightweight($sw,$source) | Set-Content -LiteralPath "$OutputDirectory\$Asset-resolved.txt"
    [Task2Sw]::MarkAllRO($sw)
    [SwProbe]::Components($sw,$source) | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-components-before.json"
    [SwProbe]::Dependencies($sw,$source) | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-dependencies.json"
    [ResearchSwCapture]::Prepare($sw,$source); $viewPrepared=$true
    if (-not $ProbeOnly -and $Asset -eq 'launcher') {
      $plan = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $PSScriptRoot 'render-sw-research-components.json') | ConvertFrom-Json
      [ResearchSwCapture]::LauncherComponents($sw,$source,[string[]]$plan.hidden,[string[]]$plan.translucent) | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-components-capture.json"
    }
    if ($rotation.Count) { [ResearchSwCapture]::Orient($sw,$source,[double[]]$rotation) | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-view.json" }
    $viewBefore = [ResearchSwCapture]::View($sw,$source)
    [ResearchSwCapture]::Bmp($sw,$source,"$OutputDirectory\$Asset-white.bmp",$Size,$true)
    [ResearchSwCapture]::Bmp($sw,$source,"$OutputDirectory\$Asset-black.bmp",$Size,$false)
    if ($viewBefore -ne [ResearchSwCapture]::View($sw,$source)) { throw 'View changed between backgrounds.' }
    $viewBefore | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-view.json"
  } finally {
    if ($sw) {
      try {
        if ($viewPrepared) { [ResearchSwCapture]::RestoreView($sw,$source) }
        [void][SwProbe]::CloseAll($sw)
        if ($old) {
          [void][Task3Sw]::SetFolders($sw,$old.folders); [Task3Sw]::SetSearch($sw,$old.search); [Task2Sw]::SetRO($sw,$old.readOnly)
          [SwImage]::Restore($sw,$old.ints,$old.doubles); [SwImage]::RestoreFrame($sw,$old.frame)
          [ResearchSwCapture]::RestoreGlobalPreferences($sw,$old.global)
          $after = @{ frame=[SwImage]::GetFrame($sw); ints=[SwImage]::GetInts($sw); doubles=[SwImage]::GetDoubles($sw); folders=[Task3Sw]::GetFolders($sw); search=[Task3Sw]::GetSearch($sw); readOnly=[Task2Sw]::GetRO($sw); global=[ResearchSwCapture]::GlobalPreferences($sw) }
          $after | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-preferences-after.json"
        }
      } finally { [SwProbe]::Exit($sw); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sw) }
    }
  }
  return
}

if (Get-Process SLDWORKS -ErrorAction SilentlyContinue) { throw 'Existing SolidWorks process; stopping.' }
$ownsLock=$false; $process=$null; $token=[Guid]::NewGuid().ToString(); $deadline=(Get-Date).AddMinutes(40)
try {
  while (-not $ownsLock) {
    try { New-Item -ItemType Directory -Path $lockPath -ErrorAction Stop | Out-Null; $ownsLock=$true }
    catch { if (-not (Test-Path -LiteralPath $lockPath -PathType Container)) { throw }; if ((Get-Date) -ge $deadline) { throw 'Heavy lock wait exceeded 40 minutes.' }; Start-Sleep -Seconds 30 }
  }
  $lockStart=Get-Date; $memoryDeadline=$lockStart.AddMinutes(10); $samples=@()
  while ($true) {
    $mb=[int](Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
    $samples+=@{ utc=(Get-Date).ToUniversalTime().ToString('o'); availableMB=$mb }
    $samples | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath "$OutputDirectory\$Asset-memory.json"
    if ($mb -ge 2000) { break }
    Write-Output "Waiting: $mb MB available."
    if ((Get-Date) -ge $memoryDeadline) { throw 'Memory below 2000 MB for 10 minutes; do not start SW.' }
    Start-Sleep -Seconds 30
  }
  & (Join-Path $PSScriptRoot 'preflight-sw-research.ps1') -OutputDirectory $OutputDirectory
  @{ token=$token; parentPid=$PID } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $ownerPath
  $pidFile=Join-Path $OutputDirectory 'owned-sw.pid'
  if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile }
  $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-Worker','-GuardToken',$token,'-Asset',$Asset,'-Size',$Size,'-OutputDirectory',('"'+$OutputDirectory+'"'))
  if ($ViewMatrix) { $arguments+=@('-ViewMatrix',$ViewMatrix) }
  if ($ProbeOnly) { $arguments+='-ProbeOnly' }
  $process=Start-Process -FilePath "$PSHOME\powershell.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput "$OutputDirectory\$Asset.stdout.log" -RedirectStandardError "$OutputDirectory\$Asset.stderr.log"
  $handle=$process.Handle
  $remaining=[Math]::Max(1,[int]($lockStart.AddMinutes(14)-(Get-Date)).TotalMilliseconds)
  if (-not $process.WaitForExit($remaining)) { throw 'SW capture exceeded lock deadline. Emergency termination may prevent preference restoration; inspect the preference backup before retrying.' }
  $process.Refresh()
  if ($process.ExitCode -ne 0) { throw "Native capture failed; inspect $OutputDirectory\$Asset.stderr.log" }
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  $pidFile=Join-Path $OutputDirectory 'owned-sw.pid'
  if ($ownsLock -and (Test-Path -LiteralPath $pidFile)) {
    $ownedPid=[int](Get-Content -LiteralPath $pidFile)
    $ownedSW=Get-Process -Id $ownedPid -ErrorAction SilentlyContinue
    if ($ownedSW -and $ownedSW.ProcessName -eq 'SLDWORKS') { Stop-Process -Id $ownedPid -Force }
  }
  if ($ownsLock) {
    try { & (Join-Path $PSScriptRoot 'preflight-sw-research.ps1') -OutputDirectory $OutputDirectory }
    finally { if (Test-Path -LiteralPath $ownerPath) { Remove-Item -LiteralPath $ownerPath }; Remove-Item -LiteralPath $lockPath }
  }
}
