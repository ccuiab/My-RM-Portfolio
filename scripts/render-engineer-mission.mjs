import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,readdir,access,rename} from 'node:fs/promises';
import {resolve,extname,join,relative} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=resolve('.'),home=homedir(),require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const browserCache=join(home,'AppData/Local/ms-playwright');
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='win32'){const versions=(await readdir(browserCache)).filter(p=>/^chromium-\d+$/.test(p)).sort();executablePath=join(browserCache,versions.at(-1),'chrome-win64/chrome.exe');}
const contentTypes={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.woff2':'font/woff2','.mp4':'video/mp4'};
const server=createServer((req,res)=>{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(relative(root,file).startsWith('..')){res.writeHead(403).end();return;}const stream=createReadStream(file);stream.on('error',()=>res.writeHead(404).end());res.setHeader('Content-Type',contentTypes[extname(file)]??'application/octet-stream');stream.pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const rangeArg=process.argv.find(x=>x.startsWith('--range=')),range=rangeArg?rangeArg.slice(8).split(':').map(Number):null;
const port=server.address().port,lang=process.argv.includes('--en')?'en':'zh',width=process.argv.includes('--draft')?1280:1920;
const audit=resolve('materials/documents/derived/audits/engineer-mission');await mkdir(audit,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width,height:width*9/16},deviceScaleFactor:1,acceptDownloads:true});
 page.on('pageerror',e=>console.error('PAGE_ERROR',String(e)));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text());else if(m.text().startsWith('ENCODE_PROGRESS'))console.log(m.text());});
 page.on('response',r=>{if(r.status()>=400)console.error('HTTP_ERROR',r.status(),r.url());});
 await page.goto(`http://127.0.0.1:${port}/materials/models/derived/inputs/engineer-mission/index.html?width=${width}&lang=${lang}${process.argv.includes('--skip-projectiles')?'&skipProjectiles=1':''}`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>window.missionFilm?.ready,null,{timeout:180000});
 const duration=await page.evaluate(()=>window.missionFilm.duration);
 if(process.argv.includes('--export-geometry')){const downloadPromise=page.waitForEvent('download',{timeout:180000});const info=await page.evaluate(()=>window.missionFilm.exportGeometry());const download=await downloadPromise;await download.saveAs(resolve('materials/models/derived/inputs/engineer-mission/collision-geometry.glb'));console.log('COLLISION_GEOMETRY',JSON.stringify(info));}
 const gpu=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';});console.log('Renderer:',gpu);
 const selected=process.argv.find(x=>x.startsWith('--times=')),scan=process.argv.find(x=>x.startsWith('--audit-range='))?.slice(14).split(':').map(Number);const shots=scan?Array.from({length:Math.round((scan[1]-scan[0])/scan[2])+1},(_,i)=>+(scan[0]+i*scan[2]).toFixed(5)):selected?selected.slice(8).split(',').map(Number):[2.5,8.5,13.1,15,18,21.5,25,28,29.5,31.5,35.5,39,42,45,48,50,53.2,57.3,58.4,61,64.8,66.2,68.4,70.5,73.2,76.9,79];
 const sourceFiles=['materials/models/derived/inputs/engineer-mission/film.js','materials/models/derived/inputs/engineer-mission/trajectory.json','materials/models/derived/inputs/engineer-mission/grasps.json','materials/models/derived/web/mission-transmitter.glb','materials/models/derived/rm2025-field/models/mission-return-route.json','materials/models/derived/rm2025-field/models/mission-arm-transfers.json','materials/models/derived/rm2025-field/models/mission-station-recovery.json'];
 const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(resolve(path))).digest('hex')])));
 const report={created:new Date().toISOString(),lang,width,gpu,range,sources,shots:[],record:null};
 const projectileReport=await page.evaluate(()=>window.missionFilm.projectileReport);if(projectileReport){await writeFile(resolve(audit,'projectiles.json'),JSON.stringify(projectileReport,null,2));
 console.log('PROJECTILES',JSON.stringify({shots:projectileReport.shots.length,impacts:projectileReport.shots.flatMap(s=>s.impacts).reduce((a,h)=>{a[h.object]=(a[h.object]??0)+1;return a;},{})}));}
 const benchmark=await page.evaluate(()=>{const start=performance.now();for(let i=0;i<20;i++)window.missionFilm.frame(44+i/30);return {fps:20*1000/(performance.now()-start)};});console.log('BENCHMARK',JSON.stringify(benchmark));report.benchmark=benchmark;
 if(process.argv.includes('--collisions')){const rows=[];for(let i=0;i<shots.length;i+=10){rows.push(...await page.evaluate(times=>window.missionFilm.auditCollisions(times),shots.slice(i,i+10)));console.log('COLLISION_PROGRESS',Math.min(i+10,shots.length),'/',shots.length);}await writeFile(resolve(audit,scan?`collision-range-${scan.join('-')}.json`:'collision-checks.json'),JSON.stringify(rows,null,2));console.log('COLLISIONS',JSON.stringify(rows.filter(r=>r.hits.length)));}
 if(process.argv.includes('--station-collisions')){const rows=await page.evaluate(times=>window.missionFilm.auditStation(times),shots);await writeFile(resolve(audit,'station-collision-checks.json'),JSON.stringify(rows,null,2));console.log('STATION_COLLISIONS',JSON.stringify(rows));}
 if(process.argv.includes('--stills')){
  for(const t of shots){const state=await page.evaluate(t=>{window.missionFilm.frame(t);return {...window.missionFilm.state};},t);await page.locator('#film').screenshot({path:resolve(audit,`shot-${String(t).replace('.','_')}-${lang}.jpg`),type:'jpeg',quality:90});report.shots.push(state);console.log('STILL',t,JSON.stringify({q:state.q.map(x=>+x.toFixed(1)),tool:state.tool.map(x=>+x.toFixed(3)),triangles:state.triangles,calls:state.drawCalls}));}
 }
 if(process.argv.includes('--record')||process.argv.includes('--smoke')){
  await page.evaluate(()=>window.missionFilm.frame(0));
  const factor=3;
  console.log('RECORDING',JSON.stringify({factor,duration}));
  const downloadPromise=page.waitForEvent('download',{timeout:600000});downloadPromise.catch(()=>{});
  report.record=await page.evaluate(({factor,frames,start})=>window.missionFilm.record(factor,frames,start),{factor,start:range?.[0]??0,frames:process.argv.includes('--smoke')?60:range?Math.round((range[1]-range[0])*30):Math.round(duration*30)});
  const download=await downloadPromise;const inputs=resolve('materials/videos/derived/inputs/engineer-mission');await mkdir(inputs,{recursive:true});
  const webm=resolve(inputs,`${range?`head-fix-${lang}-${range.join('-')}`:`engineer-mission-${lang}`}.${report.record.codec==='h264'?'h264':'webm'}`);await download.saveAs(webm);console.log('RECORDED',JSON.stringify(report.record));
  const video=range?resolve(inputs,`head-fix-${lang}-${range[0]}-${range[1]}.mp4`):resolve(process.argv.includes('--smoke')?'tmp/mission-encode-smoke.mp4':`materials/videos/derived/web/engineer-mission-${lang}.mp4`);
  const encoded=resolve(inputs,`encoded-${lang}-${Date.now()}.mp4`);
  if(report.record.codec==='h264')await command('ffmpeg',['-v','error','-fflags','+genpts','-r','30','-f','h264','-i',webm,'-an','-c:v','copy','-movflags','+faststart','-y',encoded]);
  else await command('ffmpeg',['-v','error','-i',webm,'-an','-vf',`setpts=PTS/${report.record.captureFactor},fps=30`,'-t',String(report.record.seconds),'-c:v','libx264','-preset','medium','-crf','21','-maxrate','4500k','-bufsize','9000k','-pix_fmt','yuv420p','-movflags','+faststart','-y',encoded]);
  try{await access(video);await rename(video,resolve(inputs,`previous-${lang}-${Date.now()}.mp4`));}catch(error){if(error.code!=='ENOENT')throw error;}
  await rename(encoded,video);
  if(!process.argv.includes('--smoke')&&!range){const posterTime=await page.evaluate(()=>window.missionFilm.posterTime);await command('ffmpeg',['-v','error','-ss',String(posterTime??duration*.5),'-i',video,'-frames:v','1','-q:v','2','-y',resolve(`materials/images/derived/video-posters/engineer-mission-${lang}.jpg`)]);}
  console.log('VIDEO',video);
  report.output={path:relative(root,video).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(video)).digest('hex')};
 }
 const modeSuffix=range?`-range-${range.join('-')}`:process.argv.includes('--record')?'':process.argv.includes('--station-collisions')?'-station-collisions':process.argv.includes('--collisions')?'-collisions':'-stills';
 await writeFile(resolve(audit,`render-${lang}${modeSuffix}.json`),JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
function command(program,args){return new Promise((r,j)=>{const child=spawn(program,args,{stdio:'inherit',windowsHide:true});child.on('error',j);child.on('exit',code=>code===0?r():j(new Error(program+' exit '+code)));});}
