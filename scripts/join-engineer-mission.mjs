/** Join separately reviewed, frame-aligned film segments without re-encoding. */
import {readFile,writeFile,rename}from'node:fs/promises';
import {execFileSync}from'node:child_process';
import {resolve,relative}from'node:path';
import {createHash}from'node:crypto';
import *as M from'../materials/models/derived/inputs/engineer-mission/motion.mjs';
const lang=process.argv.includes('--en')?'en':'zh',duration=M.MISSION_DURATION,dir=resolve('materials/videos/derived/inputs/engineer-mission');
const ranges=[[0,40],[40,60],[60,duration]],input=ranges.map(([a,b])=>resolve(dir,`head-fix-${lang}-${a}-${b}.mp4`)),list=resolve(dir,`mission-final-${lang}.txt`),staged=resolve(dir,`mission-final-${lang}.mp4`),output=resolve(`materials/videos/derived/web/engineer-mission-${lang}.mp4`);
const run=(p,a)=>execFileSync(p,a,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}),probe=p=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]));
for(let i=0;i<input.length;i++){const p=probe(input[i]),v=p.streams[0],expected=Math.round((ranges[i][1]-ranges[i][0])*30);if(p.streams.length!==1||v.codec_name!=='h264'||v.width!==1920||v.height!==1080||v.avg_frame_rate!=='30/1'||Number(v.nb_frames)!==expected)throw Error('Wrong segment shape '+input[i]);}
await writeFile(list,input.map(p=>`file '${p.replaceAll('\\','/')}'`).join('\n')+'\n');
run('ffmpeg',['-v','error','-f','concat','-safe','0','-i',list,'-an','-c:v','copy','-movflags','+faststart','-y',staged]);
const result=probe(staged);if(result.streams.length!==1||Number(result.streams[0].nb_frames)!==Math.round(duration*30)||Math.abs(Number(result.format.duration)-duration)>.001)throw Error('Joined frame count/duration mismatch');
const hashes=p=>run('ffmpeg',['-v','error','-i',p,'-an','-f','framemd5','-']).split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1).trim());
const expected=input.flatMap(hashes),actual=hashes(staged);if(expected.length!==actual.length||expected.some((x,i)=>x!==actual[i]))throw Error('Decoded frame differs across join');
const prior=resolve(dir,`previous-${lang}-${Date.now()}.mp4`);await rename(output,prior);try{await rename(staged,output);}catch(e){await rename(prior,output);throw e;}
run('ffmpeg',['-v','error','-ss',String(M.publicTime(51.5)),'-i',output,'-frames:v','1','-q:v','2','-y',resolve(`materials/images/derived/video-posters/engineer-mission-${lang}.jpg`)]);
await writeFile(resolve(`materials/documents/derived/audits/engineer-mission/video-join-${lang}.json`),JSON.stringify({output:relative(resolve('.'),output),segments:input.map((p,i)=>({path:relative(resolve('.'),p),range:ranges[i]})),frames:actual.length,duration,audioStreams:0,decodedFramesAllIdentical:true,sha256:createHash('sha256').update(await readFile(output)).digest('hex')},null,2));
console.log('Joined',lang,actual.length,'frames; every decoded frame matches its reviewed segment');
