# Rebuild complete, silent actions; raw sources are always read in place.
[CmdletBinding()]
param(
    [string]$MainRepository = 'D:\AI_playground\My-RM-Portfolio',
    [string]$Ffmpeg = 'ffmpeg',
    [string]$Ffprobe = 'ffprobe',
    [ValidateSet('egg-stairs', 'egg-steal', 'egg-grab', 'egg-right-hero')]
    [string[]]$Name = @('egg-stairs', 'egg-steal', 'egg-grab', 'egg-right-hero'),
    [string]$EvidenceDirectory = (Join-Path $env:LOCALAPPDATA 'Temp/rm-shots/eggs2'),
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
function AcquireHeavyLock {
    $lockPath = 'D:\AI_playground\rm-wt\locks\heavy'
    $deadline = (Get-Date).AddMinutes(40)
    while ($true) {
        try { New-Item -ItemType Directory $lockPath -ErrorAction Stop | Out-Null; return $lockPath }
        catch {
            if (-not (Test-Path -LiteralPath $lockPath)) { throw }
            if ((Get-Date) -ge $deadline) { throw 'Heavy lock timed out after 40 minutes.' }
            Write-Host 'Waiting for heavy lock (30 s).'
            Start-Sleep -Seconds 30
        }
    }
}
function CropFilter($Segment) {
    if (-not $Segment.dynamicCrop) { return '' }
    $crop = $Segment.dynamicCrop
    $knots = @($crop.keyframes)
    if ($knots.Count -lt 2 -or $knots[0].seconds -ne 0 -or $knots[-1].seconds -ne $Segment.durationSeconds) { throw 'Crop must cover the entire segment.' }
    $expression = Number $knots[-1].x
    for ($j = $knots.Count - 2; $j -ge 0; $j--) {
        $a = $knots[$j]; $b = $knots[$j + 1]
        if ($b.seconds -le $a.seconds) { throw 'Crop keyframes must be ordered.' }
        $u = "((t-$(Number $a.seconds))/$(Number ($b.seconds-$a.seconds)))"
        $value = "$(Number $a.x)+$(Number ($b.x-$a.x))*(3*pow($u,2)-2*pow($u,3))"
        $expression = "if(lt(t,$(Number $b.seconds)),$value,$expression)"
    }
    return ",crop=$($crop.width):$($crop.height):'$expression':$($crop.y)"
}
function MotionEvidence($Edit) {
    $groups = @()
    foreach ($segment in $Edit.segments) {
        foreach ($kind in @('dynamicCrop','tracking')) {
            $curve = $segment.$kind
            if (-not $curve) { continue }
            $knots = @($curve.keyframes); $j = 0; $previous = $null; $maximum = 0.0; $maxEdge = 0.0
            $samples = @()
            for ($frame = 0; $frame -le [Math]::Floor($segment.durationSeconds*30); $frame++) {
                $time = $frame/30.0
                while ($j -lt $knots.Count-2 -and $time -ge $knots[$j+1].seconds) { $j++ }
                $a = $knots[$j]; $b = $knots[$j+1]
                $u = [Math]::Min(1.0,($time-$a.seconds)/($b.seconds-$a.seconds)); $u = $u*$u*(3-2*$u)
                $point = [ordered]@{seconds=$time}
                foreach ($field in $(if ($kind -eq 'dynamicCrop') {@('x')} else {@('x','y','w','h')})) {
                    $point[$field] = [double]$a.$field+([double]$b.$field-[double]$a.$field)*$u
                }
                if ($previous) {
                    $dx = $point.x-$previous.x; $dy = $(if ($kind -eq 'tracking') {$point.y-$previous.y} else {0})
                    $maximum = [Math]::Max($maximum,[Math]::Sqrt($dx*$dx+$dy*$dy))
                    if ($kind -eq 'tracking') { $maxEdge = [Math]::Max($maxEdge,[Math]::Max([Math]::Abs($point.w-$previous.w),[Math]::Abs($point.h-$previous.h))) }
                }
                $samples += $point; $previous = $point
            }
            $groups += [ordered]@{group=$kind; source=$segment.source; fps=30; units='source crop pixels / output tracking pixels'; interpolation='smoothstep'; maxAdjacentDisplacement=$maximum; maxAdjacentSizeChange=$maxEdge; maxAdjacentRotationDegrees=0; samples=$samples}
        }
    }
    # These are video edits, without animated 3D part groups. Check the actual crop/box curves.
    [IO.File]::WriteAllText((Join-Path $EvidenceDirectory "$($Edit.name)-motion-30fps.json"), (@{groups=$groups; has3DPartGroups=$false} | ConvertTo-Json -Depth 12), $utf8)
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
        $mix = $mix * $mix * (3 - 2 * $mix)
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
        $heavyLock = AcquireHeavyLock
        try {
        $lockStarted = Get-Date
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
                '-vf', "fps=$($edit.output.fps),setsar=1,format=yuv420p", '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2', '-movflags', '+faststart', $inputPath)
            [IO.File]::WriteAllText($cachePath, $signature, $utf8)
        }
        $encoding = @('-hide_banner', '-v', 'error', '-y', '-filter_complex_threads', '2')
        $filters = @(); $total = 0.0
        for ($i = 0; $i -lt $inputPaths.Count; $i++) {
            $encoding += @('-threads', '2', '-i', $inputPaths[$i])
            $track = TrackingFilter $edit.segments[$i] $edit.output.fps $i
            $crop = CropFilter $edit.segments[$i]
            $rotate = $(if ($edit.segments[$i].rotation) {",transpose=$($edit.segments[$i].rotation)"} else {''})
            $filters += "[$($i):v]setpts=PTS-STARTPTS${rotate}${crop},scale=$($edit.output.width):$($edit.output.height):flags=lanczos,fps=$($edit.output.fps),setsar=1,settb=AVTB${track},format=yuv420p[s$i]"
            $total += [double]$edit.segments[$i].durationSeconds
        }
        if ($edit.composition.type -eq 'picture-in-picture') {
            $pip = $edit.composition
            $insetStart = [double]$pip.insetStartSeconds
            if ([Math]::Abs($edit.segments[0].durationSeconds-$edit.segments[1].durationSeconds-$insetStart) -gt .001 -or
                [Math]::Abs($edit.segments[1].startSeconds-$edit.segments[0].startSeconds-$edit.synchronization.heroMinusEngineerSeconds-$insetStart) -gt .001) { throw 'POV placement must match the verified source-clock offset.' }
            $filters += "[s1]scale=$($pip.width):$($pip.height),pad=iw+4:ih+4:2:2:color=0xf2b53a,setpts=PTS-STARTPTS+$(Number $insetStart)/TB[inset]"
            $filters += "[s0][inset]overlay=x=$($pip.x):y=$($pip.y):eof_action=pass:repeatlast=0:enable='gte(t,$(Number $insetStart))'[edit]"
            $total = [double]$edit.segments[0].durationSeconds
        } elseif ($inputPaths.Count -eq 1) { $filters += '[s0]null[edit]' }
        elseif ($inputPaths.Count -eq 2 -and $edit.transitionSeconds -gt 0) {
            $offset = [double]$edit.segments[0].durationSeconds - [double]$edit.transitionSeconds
            $filters += "[s0][s1]xfade=transition=fade:duration=$(Number $edit.transitionSeconds):offset=$(Number $offset)[edit]"
            $total -= [double]$edit.transitionSeconds
        } else { throw 'Use one source, two POVs, or two sequential shots with a short transition.' }
        # Rotate the timeline by the seam duration: the last blended head frame
        # continues into the first body frame at exactly the same source time.
        $seam = [double]$edit.loop.seamSeconds
        if ($seam -gt 0) {
            $filters += '[edit]split=2[body0][head0]'
            $filters += "[body0]trim=start=$(Number $seam),setpts=PTS-STARTPTS[body]"
            $filters += "[head0]trim=duration=$(Number $seam),setpts=PTS-STARTPTS[head]"
            $filters += "[body][head]xfade=transition=fade:duration=$(Number $seam):offset=$(Number ($total-2*$seam)),format=yuv420p[v]"
            $total -= $seam
        } else { $filters += '[edit]null[v]' }
        $encoding += @('-filter_complex', ($filters -join ';'), '-map', '[v]', '-an', '-map_metadata', '-1', '-map_chapters', '-1',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', (Number $edit.output.crf), '-maxrate', "$($edit.output.maxBitrateKbps)k", '-bufsize', "$($edit.output.maxBitrateKbps * 2)k", '-threads', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $output)
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
        MotionEvidence $edit
        $rows = [Math]::Ceiling($duration / 4)
        $sheetFilter = "select='isnan(prev_selected_t)+gte(t-prev_selected_t,1)',setpts=N/TB,scale=320:180,pad=320:202:0:0:color=0x0b1420,drawtext=fontfile='C\:/Windows/Fonts/consola.ttf':text='%{pts\:hms}':fontcolor=0xf2b53a:fontsize=14:x=4:y=183,tile=4x${rows}:padding=4:margin=4"
        Encode @('-hide_banner', '-v', 'error', '-y', '-threads', '2', '-i', $output, '-vf', $sheetFilter, '-frames:v', '1', '-q:v', '2', (Join-Path $EvidenceDirectory "$clipName-1fps.jpg"))
        [IO.File]::WriteAllText((Join-Path $EvidenceDirectory "$clipName-probe.json"), ($probe | ConvertTo-Json -Depth 12), $utf8)
        Write-Host "$clipName passed: $duration s, $((Get-Item -LiteralPath $output).Length) bytes; H.264 / yuv420p / silent."
        if (((Get-Date)-$lockStarted).TotalMinutes -ge 15) { throw 'Heavy lock exceeded its 15-minute limit.' }
        } finally { Remove-Item -LiteralPath $heavyLock }
    }
} finally { Pop-Location }
