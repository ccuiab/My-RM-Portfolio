# Run from the repository root after fetching the two referenced source sections.
# POV: BV1yk8gz8Eu2 p3, 32:55-33:30. Official: BV1Py8vzNE74, 31:52-32:15.
# Preserve both placements and the whole intervening motion at 1x; no inferred stopwatch.
$ErrorActionPreference = 'Stop'
$ffmpeg = 'C:\ffmpeg\bin\ffmpeg.exe'
& $ffmpeg -v error -y -t 17.2 -i output/video/wr58-pov.mp4 -ss 12.5 -t 4.5 -i output/video/wr58-official.mp4 -filter_complex '[0:v]fps=25,setsar=1,setpts=PTS-STARTPTS[a];[1:v]fps=25,setsar=1,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=0.24:offset=16.96,format=yuv420p[v]' -map '[v]' -an -c:v libx264 -preset medium -crf 22 -movflags +faststart public/video/exchange-58.mp4
if ($LASTEXITCODE -ne 0) { throw 'Record video encoding failed' }
& $ffmpeg -v error -y -ss 19 -i public/video/exchange-58.mp4 -frames:v 1 -q:v 2 public/video/exchange-58.jpg
if ($LASTEXITCODE -ne 0) { throw 'Record poster encoding failed' }
& $ffmpeg -v error -xerror -i public/video/exchange-58.mp4 -f null -
if ($LASTEXITCODE -ne 0) { throw 'Record video validation failed' }
