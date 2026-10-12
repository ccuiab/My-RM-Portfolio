# Rebuild complete, silent actions; raw sources are always read in place.
[CmdletBinding()]
param(
    [string]$MainRepository = 'D:\AI_playground\My-RM-Portfolio',
    [string]$Ffmpeg = 'ffmpeg',
    [string]$Ffprobe = 'ffprobe',
    [ValidateSet('egg-stairs', 'egg-steal', 'egg-grab')]
    [string[]]$Name = @('egg-stairs', 'egg-steal', 'egg-grab'),
    [string]$EvidenceDirectory = (Join-Path $env:LOCALAPPDATA 'Temp/rm-shots/eggs'),
    [switch]$ReuseInputs
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$catalog = Get-Content (Join-Path $root 'materials/documents/derived/bilibili-video-catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$invariant = [Globalization.CultureInfo]::InvariantCulture
$utf8 = [Text.UTF8Encoding]::new($false)
function Number([double]$Value) { $Value.ToString('0.########', $invariant) }
function WorkspacePath([string]$Relative) {
    $path = [IO.Path]::GetFullPath((Join-Path $root $Relative))
    if (-not $path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Output must remain inside this worktree: $Relative"
    }
    return $path
}
function Encode([string[]]$Arguments) {
    & $Ffmpeg @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed; no successful result is claimed.' }
}
function TrackingFilter($Segment, [int]$Fps, [int]$Index) {
    $tracking = $Segment.tracking
    if (-not $tracking) { return '' }
    $knots = @($tracking.keyframes)
    if ($knots.Count -lt 2 -or $knots[0].seconds -ne 0 -or $knots[-1].seconds -ne $Segment.durationSeconds) {
        throw 'Tracking must cover the entire segment.'
    }
    for ($j = 1; $j -lt $knots.Count; $j++) {
        if ($knots[$j].seconds -le $knots[$j - 1].seconds -or $knots[$j].seconds - $knots[$j - 1].seconds -gt 1.001) {
            throw 'Manual tracking samples must be ordered and at most one second apart.'
        }
    }
    $target = "drawbox@track$Index"
    $commands = [Collections.Generic.List[string]]::new()
    $j = 0
    for ($frame = 0; $frame -lt [Math]::Ceiling($Segment.durationSeconds * $Fps); $frame++) {
        $time = $frame / [double]$Fps
        while ($j -lt $knots.Count - 2 -and $time -ge $knots[$j + 1].seconds) { $j++ }
        $a = $knots[$j]; $b = $knots[$j + 1]
        $mix = ($time - $a.seconds) / ($b.seconds - $a.seconds)
        $updates = @()
        foreach ($field in @('x', 'y', 'w', 'h')) {
            $value = [Math]::Round([double]$a.$field + ([double]$b.$field - [double]$a.$field) * $mix)
            $updates += "$target $field $value"
        }
        # Occluded samples retain the last known rectangle and fade its opacity.
        $alpha = [double]$a.opacity + ([double]$b.opacity - [double]$a.opacity) * $mix
        $updates += "$target color $($tracking.color)@$(Number $alpha)"
        $commands.Add("$(Number $time) $($updates -join ',');")
    }
    $relative = "materials/videos/derived/inputs/$($Segment.inputFile.Split('/')[-1]).tracking.cmd"
    [IO.File]::WriteAllLines((WorkspacePath $relative), $commands, $utf8)
    return ",sendcmd=f='$relative',${target}=x=$($knots[0].x):y=$($knots[0].y):w=$($knots[0].w):h=$($knots[0].h):color=$($tracking.color)@$(Number $knots[0].opacity):t=$($tracking.lineWidth)"
}
Push-Location $root
try {
    New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
    foreach ($clipName in $Name) {
        $edit = Get-Content (WorkspacePath "materials/videos/derived/web/$clipName.source.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        $output = WorkspacePath $edit.output.video
        $poster = WorkspacePath $edit.output.poster
        New-Item -ItemType Directory -Force -Path (Split-Path $output -Parent), (Split-Path $poster -Parent), (WorkspacePath 'materials/videos/derived/inputs') | Out-Null
        $inputPaths = @()
        foreach ($segment in $edit.segments) {
            $entry = @($catalog.videos | Where-Object { $_.bvid -eq $segment.bvid -and $_.page -eq $segment.page })
            if ($entry.Count -ne 1 -or $entry[0].file -ne $segment.sourceFile -or $entry[0].sha256 -ne $segment.sourceSha256FromCatalog) {
                throw "Catalog mismatch: $clipName / $($segment.bvid) P$($segment.page)"
            }
            if ([Math]::Abs($segment.endSeconds - $segment.startSeconds - $segment.durationSeconds) -gt 0.001) { throw 'In/out points do not match the duration.' }
            $source = Join-Path $root $entry[0].file
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { $source = Join-Path $MainRepository $entry[0].file }
            $inputPath = WorkspacePath $segment.inputFile
            $inputPaths += $inputPath
            $signature = [ordered]@{ source = $segment.sourceSha256FromCatalog; start = $segment.startSeconds; duration = $segment.durationSeconds; fps = $edit.output.fps } | ConvertTo-Json -Compress
            $cachePath = "$inputPath.cache.json"
            if ($ReuseInputs -and (Test-Path -LiteralPath $inputPath -PathType Leaf) -and
                (Test-Path -LiteralPath $cachePath -PathType Leaf) -and [IO.File]::ReadAllText($cachePath) -eq $signature) { continue }
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing read-only source: $source" }
            Write-Host "Extracting $clipName / $($segment.bvid) P$($segment.page): $($segment.startTimecode) - $($segment.endTimecode)"
            Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-ss', (Number $segment.startSeconds), '-noautorotate', '-i', $source,
                '-t', (Number $segment.durationSeconds), '-map', '0:v:0', '-an', '-map_metadata', '-1', '-map_chapters', '-1',
                '-vf', "fps=$($edit.output.fps),setsar=1,format=yuv420p", '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-threads', '4', '-movflags', '+faststart', $inputPath)
            [IO.File]::WriteAllText($cachePath, $signature, $utf8)
        }
        $encoding = @('-hide_banner', '-v', 'error', '-y', '-filter_complex_threads', '2')
        $filters = @(); $total = 0.0
        for ($i = 0; $i -lt $inputPaths.Count; $i++) {
            $encoding += @('-threads', '2', '-i', $inputPaths[$i])
            $track = TrackingFilter $edit.segments[$i] $edit.output.fps $i
            $filters += "[$($i):v]scale=$($edit.output.width):$($edit.output.height):flags=lanczos,fps=$($edit.output.fps),setsar=1,settb=AVTB,setpts=PTS-STARTPTS${track},format=yuv420p[s$i]"
            $total += [double]$edit.segments[$i].durationSeconds
        }
        # Keep every action frame. A direct loop reset follows the settled ending;
        # no head/tail crossfade removes evidence or blends the tracking box.
        if ($inputPaths.Count -eq 1) { $filters += '[s0]null[v]' }
        else { $filters += ((0..($inputPaths.Count - 1) | ForEach-Object { "[s$_]" }) -join '') + "concat=n=$($inputPaths.Count):v=1:a=0[v]" }
        $encoding += @('-filter_complex', ($filters -join ';'), '-map', '[v]', '-an', '-map_metadata', '-1', '-map_chapters', '-1',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', (Number $edit.output.crf), '-threads', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $output)
        Write-Host "Encoding $clipName"
        Encode $encoding
        Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-ss', (Number $edit.output.posterSeconds), '-i', $output, '-frames:v', '1', '-q:v', '2', $poster)
        Encode @('-hide_banner', '-v', 'error', '-xerror', '-threads', '2', '-i', $output, '-f', 'null', '-')
        $probeText = & $Ffprobe '-v' 'error' '-show_streams' '-show_format' '-of' 'json' $output
        if ($LASTEXITCODE -ne 0) { throw "ffprobe failed: $clipName" }
        $probe = ($probeText -join "`n") | ConvertFrom-Json
        $video = @($probe.streams | Where-Object { $_.codec_type -eq 'video' }); $audio = @($probe.streams | Where-Object { $_.codec_type -eq 'audio' })
        $duration = [double]::Parse($probe.format.duration, $invariant)
        if ($video.Count -ne 1 -or $audio.Count -ne 0 -or $video[0].codec_name -ne 'h264' -or $video[0].pix_fmt -ne 'yuv420p' -or
            $video[0].width -ne $edit.output.width -or $video[0].height -ne $edit.output.height -or $video[0].avg_frame_rate -ne "$($edit.output.fps)/1" -or
            [Math]::Abs($duration - $total) -gt 0.08 -or [Math]::Abs($duration - $edit.loop.expectedDurationSeconds) -gt 0.08 -or
            (Get-Item -LiteralPath $output).Length -gt $edit.output.maxBytes) { throw "Output specification failed: $clipName" }
        if (@($edit.segments | Where-Object { $_.tracking }).Count -gt 0) {
            $rows = [Math]::Ceiling($duration / 4)
            $sheetFilter = "select='isnan(prev_selected_t)+gte(t-prev_selected_t,1)',setpts=N/TB,scale=320:180,pad=320:202:0:0:color=0x0b1420,drawtext=fontfile='C\:/Windows/Fonts/consola.ttf':text='%{pts\:hms}':fontcolor=0xf2b53a:fontsize=14:x=4:y=183,tile=4x${rows}:padding=4:margin=4"
            Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-i', $output, '-vf', $sheetFilter, '-frames:v', '1', '-q:v', '2', (Join-Path $EvidenceDirectory "$clipName-tracking-1fps.jpg"))
        }
        [IO.File]::WriteAllText((Join-Path $EvidenceDirectory "$clipName-probe.json"), ($probe | ConvertTo-Json -Depth 12), $utf8)
        Write-Host "$clipName passed: $duration s, $((Get-Item -LiteralPath $output).Length) bytes; H.264 / yuv420p / silent."
    }
} finally { Pop-Location }
