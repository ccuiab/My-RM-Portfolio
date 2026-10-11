# Rebuild the three silent web loops from their adjacent *.source.json edit lists.
# Raw sources are read in place; only short, silent intermediate clips are written.
[CmdletBinding()]
param(
    [string]$MainRepository = 'D:\AI_playground\My-RM-Portfolio',
    [string]$Ffmpeg = 'ffmpeg',
    [string]$Ffprobe = 'ffprobe',
    [ValidateSet('egg-stairs', 'egg-steal', 'egg-grab')]
    [string[]]$Name = @('egg-stairs', 'egg-steal', 'egg-grab'),
    [switch]$ReuseInputs
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$catalog = Get-Content (Join-Path $root 'materials/documents/derived/bilibili-video-catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$invariant = [Globalization.CultureInfo]::InvariantCulture

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

foreach ($clipName in $Name) {
    $edit = Get-Content (WorkspacePath "materials/videos/derived/web/$clipName.source.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $output = WorkspacePath $edit.output.video
    $poster = WorkspacePath $edit.output.poster
    New-Item -ItemType Directory -Force -Path (Split-Path $output -Parent), (Split-Path $poster -Parent), (WorkspacePath 'materials/videos/derived/inputs') | Out-Null
    $inputPaths = @()
    foreach ($segment in $edit.segments) {
        $entry = @($catalog.videos | Where-Object { $_.bvid -eq $segment.bvid -and $_.page -eq $segment.page })
        if ($entry.Count -ne 1 -or $entry[0].file -ne $segment.sourceFile) { throw "Catalog mismatch: $clipName / $($segment.bvid) P$($segment.page)" }
        $source = Join-Path $root $entry[0].file
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { $source = Join-Path $MainRepository $entry[0].file }
        $inputPath = WorkspacePath $segment.inputFile
        $inputPaths += $inputPath
        if ($ReuseInputs -and (Test-Path -LiteralPath $inputPath -PathType Leaf)) { continue }
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing read-only source: $source" }
        Write-Host "Extracting $clipName / $($segment.bvid) P$($segment.page): $($segment.startTimecode) - $($segment.endTimecode)"
        Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-ss', (Number $segment.startSeconds), '-noautorotate', '-i', $source,
            '-t', (Number $segment.durationSeconds), '-map', '0:v:0', '-an', '-map_metadata', '-1', '-map_chapters', '-1',
            '-vf', 'fps=25,setsar=1,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-threads', '4', '-movflags', '+faststart', $inputPath)
    }

    $encoding = @('-hide_banner', '-v', 'error', '-y', '-filter_complex_threads', '2')
    $filters = @()
    $total = 0.0
    for ($i = 0; $i -lt $inputPaths.Count; $i++) {
        $encoding += @('-threads', '2', '-i', $inputPaths[$i])
        $resize = if ($edit.output.width -gt $edit.output.height) { "scale=$($edit.output.width):$($edit.output.height):flags=lanczos," } else { '' }
        $filters += "[$($i):v]${resize}fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[s$i]"
        $total += [double]$edit.segments[$i].durationSeconds
    }
    $fade = [double]$edit.transitionSeconds
    if ($inputPaths.Count -eq 2) {
        $offset = Number ([double]$edit.segments[0].durationSeconds - $fade)
        $filters += "[s0][s1]xfade=transition=fade:duration=$(Number $fade):offset=$offset[narrative]"
        $total -= $fade
    } elseif ($inputPaths.Count -eq 1) {
        $filters += '[s0]null[narrative]'
    } else { throw 'Only one- or two-view edits are supported.' }

    # Blend the last six frames into the first six, then begin after those frames.
    # This softens the playback boundary without reversing or speeding up the action.
    $seam = [double]$edit.loop.seamSeconds
    $filters += '[narrative]split=2[body][head]'
    $filters += "[head]trim=start=0:end=$(Number $seam),setpts=PTS-STARTPTS[opening]"
    $filters += "[body][opening]xfade=transition=fade:duration=$(Number $seam):offset=$(Number ($total - $seam)),trim=start=$(Number $seam):end=$(Number $total),setpts=PTS-STARTPTS,fps=25,format=yuv420p[v]"
    $encoding += @('-filter_complex', ($filters -join ';'), '-map', '[v]', '-an', '-map_metadata', '-1', '-map_chapters', '-1',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-threads', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $output)
    Write-Host "Encoding $clipName"
    Encode $encoding
    Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-ss', (Number $edit.output.posterSeconds), '-i', $output, '-frames:v', '1', '-q:v', '2', $poster)
    Encode @('-hide_banner', '-v', 'error', '-xerror', '-threads', '2', '-i', $output, '-f', 'null', '-')
    $probeText = & $Ffprobe '-v' 'error' '-show_streams' '-show_format' '-of' 'json' $output
    if ($LASTEXITCODE -ne 0) { throw "ffprobe failed: $clipName" }
    $probe = ($probeText -join "`n") | ConvertFrom-Json
    $video = @($probe.streams | Where-Object { $_.codec_type -eq 'video' })
    $audio = @($probe.streams | Where-Object { $_.codec_type -eq 'audio' })
    $duration = [double]::Parse($probe.format.duration, $invariant)
    if ($video.Count -ne 1 -or $audio.Count -ne 0 -or $video[0].codec_name -ne 'h264' -or $video[0].pix_fmt -ne 'yuv420p' -or
        $video[0].width -ne $edit.output.width -or $video[0].height -ne $edit.output.height -or $duration -lt 5 -or $duration -gt 15 -or
        [Math]::Abs($duration - ($total - $seam)) -gt 0.08 -or (Get-Item -LiteralPath $output).Length -gt 6000000) {
        throw "Output specification failed: $clipName"
    }
    Write-Host "$clipName passed: $duration s, $((Get-Item -LiteralPath $output).Length) bytes; H.264 / yuv420p / silent."
}
