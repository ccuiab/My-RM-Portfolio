# Rebuild complete, silent actions; raw sources are always read in place.
[CmdletBinding()]
param(
    [string]$MainRepository = 'D:\AI_playground\My-RM-Portfolio',
    [string]$Ffmpeg = 'ffmpeg',
    [string]$Ffprobe = 'ffprobe',
    [ValidateSet('egg-stairs', 'egg-steal', 'egg-grab', 'egg-right-hero')]
    [string[]]$Name = @('egg-stairs', 'egg-steal', 'egg-grab', 'egg-right-hero'),
    [string]$EvidenceDirectory = (Join-Path $env:LOCALAPPDATA 'Temp/rm-shots/eggs3'),
    [switch]$ReuseInputs,
    [switch]$AuditTrackingOnly
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$catalog = Get-Content (Join-Path $root 'materials/documents/derived/bilibili-video-catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$invariant = [Globalization.CultureInfo]::InvariantCulture
$utf8 = [Text.UTF8Encoding]::new($false)
$permissionTemplate = [ordered]@{
    permissionStatus = '用户 2026-10-12 确认：可以转载，条件是标明来源并提供原片跳转链接。'
}
function SaveConfirmedPermission($Edit, [string]$ClipName) {
    if ($ClipName -notin @('egg-steal', 'egg-right-hero')) { return }
    if ($Edit.copyright.permissionStatus -eq $permissionTemplate.permissionStatus) { return }
    $Edit.copyright.permissionStatus = $permissionTemplate.permissionStatus
    [IO.File]::WriteAllText((WorkspacePath "materials/videos/derived/web/$ClipName.source.json"), ($Edit | ConvertTo-Json -Depth 32) + "`n", $utf8)
}
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
    $lockPath = (Join-Path $PSScriptRoot '../tmp/locks/heavy')
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
function TrackingValue($Knots, [double]$Time, [string]$Field, [switch]$Monotone) {
    $knots = @($Knots); $j = 0
    while ($j -lt $knots.Count-2 -and $Time -ge $knots[$j+1].seconds) { $j++ }
    $values = @($knots | ForEach-Object {
        $value = $_; foreach ($part in $Field.Split('.')) { $value = $value.$part }; [double]$value
    })
    $h = [double]$knots[$j+1].seconds-$knots[$j].seconds
    $u = [Math]::Max(0.0,[Math]::Min(1.0,($Time-$knots[$j].seconds)/$h))
    if (-not $Monotone) { return $values[$j]+($values[$j+1]-$values[$j])*$u }
    $slopes = @()
    for ($k=0;$k -lt $knots.Count;$k++) {
        if ($k -eq 0) { $slopes += ($values[1]-$values[0])/($knots[1].seconds-$knots[0].seconds); continue }
        if ($k -eq $knots.Count-1) { $slopes += ($values[$k]-$values[$k-1])/($knots[$k].seconds-$knots[$k-1].seconds); continue }
        $before = $knots[$k].seconds-$knots[$k-1].seconds; $after = $knots[$k+1].seconds-$knots[$k].seconds
        $left = ($values[$k]-$values[$k-1])/$before; $right = ($values[$k+1]-$values[$k])/$after
        if ($left*$right -le 0) { $slopes += 0.0 }
        else { $w1=2*$after+$before; $w2=$after+2*$before; $slopes += ($w1+$w2)/($w1/$left+$w2/$right) }
    }
    return (2*$u*$u*$u-3*$u*$u+1)*$values[$j]+($u*$u*$u-2*$u*$u+$u)*$h*$slopes[$j]+(-2*$u*$u*$u+3*$u*$u)*$values[$j+1]+($u*$u*$u-$u*$u)*$h*$slopes[$j+1]
}
function TrackingObservation($Tracking, [double]$Time) {
    $observations=@($Tracking.observations); $j=0
    while ($j -lt $observations.Count-2 -and $Time -ge $observations[$j+1].seconds) { $j++ }
    $a=$observations[$j];$b=$observations[$j+1]
    $u=[Math]::Max(0.0,[Math]::Min(1.0,($Time-$a.seconds)/($b.seconds-$a.seconds)))
    $body=[ordered]@{}
    foreach ($field in @('x','y','w','h')) { $body[$field]=TrackingValue $observations $Time "body.$field" -Monotone }
    $result=[ordered]@{body=[pscustomobject]$body}
    foreach ($kind in @('otherRobots','bloodBars')) {
        $boxes=@()
        for ($k=0;$k -lt @($a.$kind).Count;$k++) {
            $ra=$a.$kind[$k];$rb=$b.$kind[$k]
            if ($ra.id -ne $rb.id) { throw 'Observation identities must remain ordered.' }
            $box=[ordered]@{id=$ra.id}
            foreach ($field in @('x','y','w','h')) { $box[$field]=[double]$ra.$field+([double]$rb.$field-[double]$ra.$field)*$u }
            $boxes += [pscustomobject]$box
        }
        $result[$kind]=$boxes
    }
    return [pscustomobject]$result
}
function BoxOverlap($A,$B) {
    $w=[Math]::Max([double]0,[Math]::Min([double]($A.x+$A.w),[double]($B.x+$B.w))-[Math]::Max([double]$A.x,[double]$B.x))
    $h=[Math]::Max([double]0,[Math]::Min([double]($A.y+$A.h),[double]($B.y+$B.h))-[Math]::Max([double]$A.y,[double]$B.y))
    return $w*$h
}
function TrackingPose($Tracking, [double]$Time) {
    $knots = @($Tracking.keyframes); $j = 0
    while ($j -lt $knots.Count-2 -and $Time -ge $knots[$j+1].seconds) { $j++ }
    $a = $knots[$j]; $b = $knots[$j+1]
    $u = [Math]::Max(0.0, [Math]::Min(1.0, ($Time-$a.seconds)/($b.seconds-$a.seconds)))
    $u = $u*$u*(3-2*$u)
    $point = [ordered]@{seconds=$Time}
    foreach ($field in @('x','y','w','h','opacity')) {
        $point[$field] = [double]$a.$field+([double]$b.$field-[double]$a.$field)*$u
        if ($Tracking.interpolation -eq 'monotone-cubic') { $point[$field]=TrackingValue $knots $Time $field -Monotone }
    }
    if ($Tracking.interpolation -eq 'monotone-cubic') {
        foreach ($field in @('labelX','labelY')) { $point[$field]=TrackingValue $knots $Time $field -Monotone }
    }
    if ($Tracking.introSeconds -gt 0 -and $Time -lt $Tracking.introSeconds) {
        $v = $Time/[double]$Tracking.introSeconds; $v = $v*$v*(3-2*$v)
        $extra = [double]$Tracking.introScaleExtra*(1-$v)
        if ($null -ne $Tracking.introMaxExpansionPixels) {
            $expansion=[double]$Tracking.introMaxExpansionPixels*(1-$v)
            $point.x-=$expansion;$point.y-=$expansion;$point.w+=2*$expansion;$point.h+=2*$expansion
        } else {
            $point.x -= $point.w*$extra/2; $point.y -= $point.h*$extra/2
            $point.w *= 1+$extra; $point.h *= 1+$extra
        }
    }
    if ($Tracking.observations) {
        $observed=TrackingObservation $Tracking $Time; $gap=[double]$Tracking.neighborGapPixels
        foreach ($other in $observed.otherRobots) {
            $expanded=[pscustomobject]@{x=$point.x-$gap;y=$point.y-$gap;w=$point.w+2*$gap;h=$point.h+2*$gap}
            if ((BoxOverlap $expanded $other) -le 0) { continue }
            $right=$point.x+$point.w;$bottom=$point.y+$point.h
            $leftCut=$other.x+$other.w+$gap;$topCut=$other.y+$other.h+$gap
            $candidates=@(
                [pscustomobject]@{x=$point.x;y=$point.y;w=[Math]::Min($right,$other.x-$gap)-$point.x;h=$point.h},
                [pscustomobject]@{x=[Math]::Max($point.x,$leftCut);y=$point.y;w=$right-[Math]::Max($point.x,$leftCut);h=$point.h},
                [pscustomobject]@{x=$point.x;y=$point.y;w=$point.w;h=[Math]::Min($bottom,$other.y-$gap)-$point.y},
                [pscustomobject]@{x=$point.x;y=[Math]::Max($point.y,$topCut);w=$point.w;h=$bottom-[Math]::Max($point.y,$topCut)}
            )
            $best=$null;$bestScore=[double]::NegativeInfinity
            foreach ($candidate in $candidates) {
                if ($candidate.w -lt 12 -or $candidate.h -lt 12) { continue }
                $dx=$candidate.x+$candidate.w/2-$observed.body.x-$observed.body.w/2
                $dy=$candidate.y+$candidate.h/2-$observed.body.y-$observed.body.h/2
                $score=(BoxOverlap $candidate $observed.body)-.01*($dx*$dx+$dy*$dy)
                if ($score -gt $bestScore) { $best=$candidate;$bestScore=$score }
            }
            if (-not $best) { throw 'No unambiguous tracking rectangle remains.' }
            foreach ($field in @('x','y','w','h')) { $point[$field]=$best.$field }
        }
    }
    return [pscustomobject]$point
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
                if ($kind -eq 'tracking') {
                    $pose = TrackingPose $curve $time
                    foreach ($field in @('x','y','w','h')) { $point[$field] = $pose.$field }
                }
                if ($previous) {
                    $dx = $point.x-$previous.x; $dy = $(if ($kind -eq 'tracking') {$point.y-$previous.y} else {0})
                    $maximum = [Math]::Max($maximum,[Math]::Sqrt($dx*$dx+$dy*$dy))
                    if ($kind -eq 'tracking') { $maxEdge = [Math]::Max($maxEdge,[Math]::Max([Math]::Abs($point.w-$previous.w),[Math]::Abs($point.h-$previous.h))) }
                }
                $samples += $point; $previous = $point
            }
            $interpolation=$(if($kind -eq 'tracking' -and $curve.interpolation){$curve.interpolation}else{'smoothstep'})
            $groups += [ordered]@{group=$kind; source=$segment.source; fps=30; units='source crop pixels / output tracking pixels'; interpolation=$interpolation; maxAdjacentDisplacement=$maximum; maxAdjacentSizeChange=$maxEdge; maxAdjacentRotationDegrees=0; samples=$samples}
        }
    }
    # These are video edits, without animated 3D part groups. Check the actual crop/box curves.
    [IO.File]::WriteAllText((Join-Path $EvidenceDirectory "$($Edit.name)-motion-30fps.json"), (@{groups=$groups; has3DPartGroups=$false} | ConvertTo-Json -Depth 12), $utf8)
}
function HudTrackingFilter($Segment, [int]$Fps, [int]$Index) {
    $tracking = $Segment.tracking
    if ($tracking.lineWidth -ne 5 -or $tracking.color -ne '0xf2b53a' -or $tracking.label -ne 'HKUST ENGINEER') {
        throw 'HUD marker requires the verified amber, 5 px stroke and short team label.'
    }
    $commands = [Collections.Generic.List[string]]::new(); $initial = @()
    for ($frame = 0; $frame -lt [Math]::Ceiling($Segment.durationSeconds*$Fps); $frame++) {
        $time = $frame/[double]$Fps; $p = TrackingPose $tracking $time
        $x = [Math]::Round($p.x); $y = [Math]::Round($p.y)
        $w = [Math]::Round($p.w); $h = [Math]::Round($p.h)
        $stroke = [int]$tracking.lineWidth
        $length = [Math]::Min([int]$tracking.cornerLength,[Math]::Floor([Math]::Min($w,$h)/2)-3)
        # Eight filled bars form four open HUD corners. The dark bars underneath
        # stay 2 px wider on every edge, including against bright field surfaces.
        $bars = @(
            @($x,$y,$length,$stroke), @($x,$y,$stroke,$length),
            @(($x+$w-$length),$y,$length,$stroke), @(($x+$w-$stroke),$y,$stroke,$length),
            @($x,($y+$h-$stroke),$length,$stroke), @($x,($y+$h-$length),$stroke,$length),
            @(($x+$w-$length),($y+$h-$stroke),$length,$stroke), @(($x+$w-$stroke),($y+$h-$length),$stroke,$length)
        )
        $updates = @()
        foreach ($layer in @('outline','amber')) {
            for ($k = 0; $k -lt $bars.Count; $k++) {
                $bar = $bars[$k]; $pad = $(if ($layer -eq 'outline') {2} else {0})
                $target = "drawbox@hud${Index}_${layer}_$k"
                $color = $(if ($layer -eq 'outline') {'0x0b1420'} else {$tracking.color})
                $values = @(($bar[0]-$pad),($bar[1]-$pad),($bar[2]+2*$pad),($bar[3]+2*$pad))
                for ($f = 0; $f -lt 4; $f++) { $updates += "$target $(@('x','y','w','h')[$f]) $($values[$f])" }
                $updates += "$target color $color@$(Number $p.opacity)"
                if ($frame -eq 0) { $initial += "${target}=x=$($values[0]):y=$($values[1]):w=$($values[2]):h=$($values[3]):color=$color@$(Number $p.opacity):t=fill" }
            }
        }
        $labelTarget = "drawtext@hud${Index}_label"
        $labelX=$(if($null -ne $p.labelX){[Math]::Round($p.labelX)}else{$x})
        $labelY=$(if($null -ne $p.labelY){[Math]::Round($p.labelY)}else{$y-27})
        $updates += "$labelTarget x $labelX", "$labelTarget y $labelY", "$labelTarget fontcolor $($tracking.color)@$(Number $p.opacity)", "$labelTarget boxcolor 0x0b1420@$(Number (.95*$p.opacity))"
        if ($frame -eq 0) {
            $initial += "${labelTarget}=fontfile='C\:/Windows/Fonts/consolab.ttf':text='$($tracking.label)':fontsize=15:fontcolor=$($tracking.color):x=${labelX}:y=${labelY}:box=1:boxcolor=0x0b1420@0.95:boxborderw=5"
        }
        $commands.Add("$(Number $time) $($updates -join ',');")
    }
    $relative = "materials/videos/derived/inputs/$($Segment.inputFile.Split('/')[-1]).tracking.cmd"
    [IO.File]::WriteAllLines((WorkspacePath $relative), $commands, $utf8)
    return ",sendcmd=f='$relative',$($initial -join ',')"
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
    if ($tracking.style -eq 'hud-corners') { return HudTrackingFilter $Segment $Fps $Index }
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
function AuditTracking($Edit) {
    $tracking=@($Edit.segments | Where-Object {$_.tracking})[0].tracking
    if (-not $tracking.observations) { throw 'Tracking audit requires independently measured vehicle observations.' }
    $checks=@();$maximumOverlap=0.0;$maximumLabelOverlap=0.0;$maximumCenter=0.0;$maximumFrameStep=0.0;$maximumSizeStep=0.0
    foreach ($fps in @(5,25,30)) {
        $previous=$null;$maximumAtFps=0.0;$maxStepAtFps=0.0
        for ($frame=0;$frame -le [Math]::Floor(5.2*$fps);$frame++) {
            $time=$frame/[double]$fps;$pose=TrackingPose $tracking $time;$observed=TrackingObservation $tracking $time
            $box=[pscustomobject]@{x=[Math]::Round($pose.x);y=[Math]::Round($pose.y);w=[Math]::Round($pose.w);h=[Math]::Round($pose.h)}
            $paint=[pscustomobject]@{x=$box.x-2;y=$box.y-2;w=$box.w+4;h=$box.h+4}
            $label=[pscustomobject]@{x=[Math]::Round($pose.labelX)-5;y=[Math]::Round($pose.labelY)-5;w=$tracking.labelReservedWidthPixels;h=$tracking.labelReservedHeightPixels}
            $overlap=0.0;$labelOverlap=0.0
            if($pose.opacity -gt .00001) {
                foreach($other in $observed.otherRobots){$overlap=[Math]::Max($overlap,(BoxOverlap $paint $other));$labelOverlap=[Math]::Max($labelOverlap,(BoxOverlap $label $other))}
                foreach($bar in $observed.bloodBars){$labelOverlap=[Math]::Max($labelOverlap,(BoxOverlap $label $bar))}
                $labelOverlap=[Math]::Max($labelOverlap,(BoxOverlap $label $observed.body))
                $dx=$box.x+$box.w/2-$observed.body.x-$observed.body.w/2;$dy=$box.y+$box.h/2-$observed.body.y-$observed.body.h/2
                $center=[Math]::Sqrt($dx*$dx+$dy*$dy);$maximumAtFps=[Math]::Max($maximumAtFps,$center)
                $maximumOverlap=[Math]::Max($maximumOverlap,$overlap);$maximumLabelOverlap=[Math]::Max($maximumLabelOverlap,$labelOverlap)
                if($box.w -lt 18 -or $box.h -lt 18){throw 'Collision trimming left an unreadable marker.'}
                $checks += [ordered]@{fps=$fps;seconds=$time;body=$observed.body;frame=$box;labelReserved=$label;centerDeviationPixels=$center;otherRobotOverlapPixels=$overlap;labelObstacleOverlapPixels=$labelOverlap;opacity=$pose.opacity;bodyCoverage=(BoxOverlap $box $observed.body)/($observed.body.w*$observed.body.h)}
            }
            if($previous){
                $step=[Math]::Sqrt([Math]::Pow($pose.x-$previous.x,2)+[Math]::Pow($pose.y-$previous.y,2));$maxStepAtFps=[Math]::Max($maxStepAtFps,$step)
                if($fps -eq 30){$maximumSizeStep=[Math]::Max($maximumSizeStep,[Math]::Max([Math]::Abs($pose.w-$previous.w),[Math]::Abs($pose.h-$previous.h)))}
            }
            $previous=$pose
        }
        $maximumCenter=[Math]::Max($maximumCenter,$maximumAtFps)
        if($fps -eq 30){$maximumFrameStep=$maxStepAtFps}
    }
    $boundaryGap=0.0
    foreach($time in @(@($tracking.keyframes | ForEach-Object {$_.seconds}) + @($tracking.introSeconds))) {
        if($time -le 0 -or $time -ge $tracking.keyframes[-1].seconds){continue}
        $left=TrackingPose $tracking ($time-.0000001);$right=TrackingPose $tracking ($time+.0000001)
        foreach($field in @('x','y','w','h','labelX','labelY')){$boundaryGap=[Math]::Max($boundaryGap,[Math]::Abs($right.$field-$left.$field))}
    }
    $result=[ordered]@{annotationFps=5;annotationPoints=@($tracking.observations).Count;sampleFps=@(5,25,30);includesRoundedEncoderCoordinates=$true;includesDarkOutlinePixels=2;maxCenterDeviationPixels=$maximumCenter;maxOtherRobotOverlapPixels=$maximumOverlap;maxLabelObstacleOverlapPixels=$maximumLabelOverlap;maxAdjacentDisplacementAt30fps=$maximumFrameStep;maxAdjacentSizeChangeAt30fps=$maximumSizeStep;maxBoundaryGapPixels=$boundaryGap;manualPixelTolerance=$tracking.annotationPixelTolerance;checks=$checks}
    New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
    [IO.File]::WriteAllText((Join-Path $EvidenceDirectory "$($Edit.name)-geometry-audit.json"),($result | ConvertTo-Json -Depth 12),$utf8)
    Write-Host "Geometry audit: center <= $(Number $maximumCenter) px; robot overlap $(Number $maximumOverlap) px2; label overlap $(Number $maximumLabelOverlap) px2."
    if($maximumOverlap -gt 0 -or $maximumLabelOverlap -gt 0){throw 'Tracking geometry overlaps a different vehicle or the label covers a body/health bar.'}
    if($maximumSizeStep -gt 8 -or $boundaryGap -gt .001){throw 'Avoidance switches create an abrupt size change or a discontinuity.'}
    return $result
}
if ($AuditTrackingOnly) {
    foreach ($clipName in $Name) {
        $edit=Get-Content (WorkspacePath "materials/videos/derived/web/$clipName.source.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        AuditTracking $edit | Out-Null
        MotionEvidence $edit
    }
    return
}
Push-Location $root
try {
    New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
    foreach ($clipName in $Name) {
        $heavyLock = AcquireHeavyLock
        try {
        $lockStarted = Get-Date
        $edit = Get-Content (WorkspacePath "materials/videos/derived/web/$clipName.source.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        SaveConfirmedPermission $edit $clipName
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
            # Keep the Hero's original coordinate space until the menu-free crop.
            $scale = $(if ($i -eq 1 -and $edit.composition.menuCrop) {''} else {",scale=$($edit.output.width):$($edit.output.height):flags=lanczos"})
            $filters += "[$($i):v]setpts=PTS-STARTPTS${rotate}${crop}${scale},fps=$($edit.output.fps),setsar=1,settb=AVTB${track},format=yuv420p[s$i]"
            $total += [double]$edit.segments[$i].durationSeconds
        }
        if ($clipName -eq 'egg-right-hero' -and $edit.composition.type -eq 'staged-split-to-hero') {
            # 04 only: engineer approach -> synchronized, menu-free split -> full Hero POV.
            $layout = $edit.composition
            $join = [double]$layout.heroStartSeconds
            $full = [double]$layout.fullHeroStartSeconds
            $introFade = [double]$layout.introFadeSeconds
            $fullFade = [double]$layout.fullHeroFadeSeconds
            $total = [double]$edit.segments[0].durationSeconds
            if ($inputPaths.Count -ne 2 -or $edit.output.width -lt 1280 -or $introFade -gt .3 -or $fullFade -gt .3 -or
                [Math]::Abs($total-$join-$edit.segments[1].durationSeconds) -gt .001 -or
                [Math]::Abs($edit.segments[1].startSeconds-$edit.segments[0].startSeconds-$edit.synchronization.heroMinusEngineerSeconds-$join) -gt .001 -or
                $full -le $join+$introFade -or $full+$fullFade -ge $total) { throw '04 source alignment or staged transition is invalid.' }
            $copy = [IO.File]::ReadAllText((WorkspacePath 'src/data/content.ts'))
            $labelFilters = @{}
            foreach ($key in @('povLabel','engineerPovLabel')) {
                $match = [regex]::Match($copy, "(?s)index: '04'.*?$($key): \{ zh: '([^']+)', en: '([^']+)' \}")
                if (-not $match.Success) { throw "04 label must come from bilingual content.ts: $key" }
                $relative = "materials/videos/derived/inputs/egg-right-hero-$key.txt"
                [IO.File]::WriteAllText((WorkspacePath $relative), "$($match.Groups[1].Value) / $($match.Groups[2].Value)", $utf8)
                # Same amber text, dark backing and unobtrusive HUD treatment as 02.
                $labelFilters[$key] = "drawtext=fontfile='C\:/Windows/Fonts/msyh.ttc':textfile='$relative':fontcolor=0xf2b53a:fontsize=24:box=1:boxcolor=0x0b1420@0.86:boxborderw=8:x=20:y=142"
            }
            $half = [int]($edit.output.width/2)
            $mc = $layout.menuCrop
            $cropHeight = [int](2*[Math]::Round(($half*$mc.height/$mc.width)/2))
            $halfY = [int](($edit.output.height-$edit.output.height/2)/2)
            $cropY = [int](($edit.output.height-$cropHeight)/2)
            $filters += '[s0]split=2[solo0][engineerHalf0]'
            $filters += '[s1]split=2[heroCrop0][heroFull0]'
            $filters += "[solo0]trim=duration=$(Number ($join+$introFade)),setpts=PTS-STARTPTS[solo]"
            $filters += "[engineerHalf0]trim=start=$(Number $join):end=$(Number ($full+$fullFade)),setpts=PTS-STARTPTS,scale=${half}:$($edit.output.height/2):flags=lanczos,pad=${half}:$($edit.output.height):0:${halfY}:color=0x0b1420,$($labelFilters.engineerPovLabel)[engineerHalf]"
            $filters += "[heroCrop0]trim=duration=$(Number ($full-$join+$fullFade)),setpts=PTS-STARTPTS,crop=$($mc.width):$($mc.height):$($mc.x):$($mc.y),scale=${half}:${cropHeight}:flags=lanczos,pad=${half}:$($edit.output.height):0:${cropY}:color=0x0b1420,$($labelFilters.povLabel)[heroHalf]"
            $filters += "[engineerHalf][heroHalf]hstack=inputs=2:shortest=1,drawbox=x=$($half-1):y=176:w=2:h=368:color=0xf2b53a:t=fill[splitView]"
            $fullLabel = $labelFilters.povLabel.Replace('y=142','y=64')
            $filters += "[heroFull0]trim=start=$(Number ($full-$join)),setpts=PTS-STARTPTS,scale=$($edit.output.width):$($edit.output.height):flags=lanczos,${fullLabel}[heroFull]"
            $filters += "[solo][splitView]xfade=transition=fade:duration=$(Number $introFade):offset=$(Number $join)[withSplit]"
            $filters += "[withSplit][heroFull]xfade=transition=fade:duration=$(Number $fullFade):offset=$(Number $full)[edit]"
        } elseif ($edit.composition.type -eq 'picture-in-picture') {
            $pip = $edit.composition
            $insetStart = [double]$pip.insetStartSeconds
            if ([Math]::Abs($edit.segments[0].durationSeconds-$edit.segments[1].durationSeconds-$insetStart) -gt .001 -or
                [Math]::Abs($edit.segments[1].startSeconds-$edit.segments[0].startSeconds-$edit.synchronization.heroMinusEngineerSeconds-$insetStart) -gt .001) { throw 'POV placement must match the verified source-clock offset.' }
            if ($pip.menuCrop) {
                if ($insetStart -ne 0) { throw 'Menu-free Hero POV must cover the complete synchronized action.' }
                $mc = $pip.menuCrop; $switch = [double]$pip.fullViewStartSeconds; $fade = [double]$pip.switchFadeSeconds
                $filters += '[s1]split=2[crop0][full0]'
                $filters += "[crop0]crop=$($mc.width):$($mc.height):$($mc.x):$($mc.y),scale=$($pip.width):$($mc.outputHeight):flags=lanczos,pad=iw+4:ih+4:2:2:color=0xf2b53a,format=yuva420p,fade=t=out:st=$(Number $switch):d=$(Number $fade):alpha=1[cropped]"
                $filters += "[full0]scale=$($pip.width):$($pip.height):flags=lanczos,pad=iw+4:ih+4:2:2:color=0xf2b53a,format=yuva420p,fade=t=in:st=$(Number $switch):d=$(Number $fade):alpha=1[full]"
                $filters += "[s0][cropped]overlay=x=$($pip.x):y=$($pip.y):eof_action=pass:repeatlast=0:enable='lt(t,$(Number ($switch+$fade)))'[withCrop]"
                $filters += "[withCrop][full]overlay=x=$($pip.x):y=$($pip.y):eof_action=pass:repeatlast=0:enable='gte(t,$(Number $switch))'[edit]"
            } else {
                $filters += "[s1]scale=$($pip.width):$($pip.height),pad=iw+4:ih+4:2:2:color=0xf2b53a,setpts=PTS-STARTPTS+$(Number $insetStart)/TB[inset]"
                $filters += "[s0][inset]overlay=x=$($pip.x):y=$($pip.y):eof_action=pass:repeatlast=0:enable='gte(t,$(Number $insetStart))'[edit]"
            }
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
