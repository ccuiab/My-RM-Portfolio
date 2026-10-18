import {readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
const lang=process.argv.includes('--en')?'en':'zh',root=resolve('.'),dir=resolve('materials/videos/derived/inputs/engineer-mission');
const source=resolve(`materials/videos/derived/web/engineer-mission-${lang}.mp4`),patch=resolve(dir,`head-fix-${lang}-22-44.mp4`),before=resolve(dir,`head-prefix-${lang}.mp4`),after=resolve(dir,`head-tail-${lang}.mp4`),list=resolve(dir,`head-concat-${lang}.txt`),staged=resolve(dir,`head-joined-${lang}.mp4`);
for(const path of[source,patch,before,after,list,staged])if(relative(root,path).startsWith('..'))throw new Error('Path outside workspace');
const run=(p,a)=>execFileSync(p,a,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
const probe=p=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]));
const base=probe(source),segment=probe(patch);if(base.streams[0].nb_frames!=='2400'||segment.streams[0].nb_frames!=='660'||base.streams[0].has_b_frames!==0)throw new Error('Unexpected source or segment shape');
run('ffmpeg',['-v','error','-i',source,'-t','22','-an','-c','copy','-y',before]);
run('ffmpeg',['-v','error','-ss','44','-i',source,'-an','-c','copy','-avoid_negative_ts','make_zero','-y',after]);
await writeFile(list,[before,patch,after].map(p=>`file '${p.replaceAll('\\','/')}'`).join('\n')+'\n');
run('ffmpeg',['-v','error','-f','concat','-safe','0','-i',list,'-an','-c','copy','-movflags','+faststart','-y',staged]);
const result=probe(staged);if(result.streams.length!==1||result.streams[0].nb_frames!=='2400'||Math.abs(Number(result.format.duration)-80)>.001)throw new Error('Patched film lost frame count or duration');
function frameHash(p,t){return run('ffmpeg',['-v','error','-ss',String(t),'-i',p,'-frames:v','1','-f','framemd5','-']).split('\n').filter(x=>x&&!x.startsWith('#')).at(-1)?.split(',').at(-1)?.trim();}
const checks=[];for(const t of[1,21,44,49.5,79]){const a=frameHash(source,t),b=frameHash(staged,t);if(a!==b)throw new Error('Unchanged frame differs at '+t);checks.push({time:t,unchanged:true,md5:a});}
for(const t of[24,28.7,31.5,39]){const a=frameHash(patch,t-22),b=frameHash(staged,t);if(a!==b)throw new Error('Replacement frame differs at '+t);checks.push({time:t,replacementMatches:true,md5:a});}
const prior=resolve(dir,`pre-head-fix-${lang}-${Date.now()}.mp4`);await rename(source,prior);try{await rename(staged,source);}catch(e){await rename(prior,source);throw e;}
const sha256=createHash('sha256').update(await readFile(source)).digest('hex');await writeFile(resolve('materials/documents/derived/audits/engineer-mission',`video-patch-${lang}.json`),JSON.stringify({source:relative(root,source),prior:relative(root,prior),replacement:relative(root,patch),range:[22,44],method:'Frame-aligned lossless H.264 remux at existing 2-second keyframes; preserve prefix and tail.',frames:2400,duration:80,audioStreams:0,sha256,checks},null,2));
console.log('Patched',lang,'2400 frames,80 seconds;9 decoded frame hash checks passed',sha256);
