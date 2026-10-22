/** Focused source preview for B without a full website build. --stills records
 * the actual WebGL view plus its production CSS overlays for visual review. */
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,relative,extname} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
const root=resolve('.'),temporary=resolve('tmp/arm-study-revision');await mkdir(temporary,{recursive:true});
const component=await readFile('src/components/ArmExplode.astro','utf8');
const styles=[...component.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1].replace(/:global\(([^)]+)\)/g,'$1')).join('\n');
const entry=`
import {loadArmExplodeScene} from '../../src/scripts/arm-explode-scene';
import {sceneCopy} from '../../src/data/content';
import {ARM_STUDY_DURATION,ARM_STUDY_CLIMB_START,ARM_STUDY_STARTS,ARM_STUDY_SHOTS} from '../../src/scripts/arm-study-story';
const L=sceneCopy.armExplode,t=(x:any)=>x.zh;
const copy={climb:t(L.climbTitle),climbDescription:t(L.climbDescription),climbFeatures:L.climbFeatures.map(t),pathNames:L.pathNames.map(t),limitBoundary:t(L.limitBoundary),workspaceBoundary:t(L.workspaceBoundary),finale:t(L.finaleTitle),finaleDescription:t(L.finaleDescription),overview:t(L.overview),caption:t(L.caption),names:L.groupNames.map(t),descriptions:L.descriptions.map(t),features:L.features.map(items=>items.map(t)),routes:L.routeSteps.map(items=>items.map(t)),phases:Object.fromEntries(Object.entries(L.phase).map(([k,v])=>[k,t(v)]))};
const root=document.querySelector<HTMLElement>('[data-arm-explode]')!;root.dataset.copy=JSON.stringify(copy);
root.querySelector('[data-play]')!.setAttribute('data-start',t(L.play));root.querySelector('[data-play]')!.setAttribute('data-stop',t(L.pause));
const stage=await loadArmExplodeScene(root,'/',new AbortController().signal);stage.setVisible(true);
const limitIndex=ARM_STUDY_SHOTS.findIndex(s=>s.id===6),limitShot=ARM_STUDY_SHOTS[limitIndex];
(window as any).armReview={ready:true,duration:ARM_STUDY_DURATION,climbStart:ARM_STUDY_CLIMB_START,limitStart:ARM_STUDY_STARTS[limitIndex]+limitShot.approach+limitShot.opening+limitShot.inspect+limitShot.closing,limitDuration:limitShot.motion,stage};
`;
await writeFile(join(temporary,'entry.ts'),entry);
const plugin={name:'omit-unused-image-imports',setup(b){b.onResolve({filter:/\.(png|jpe?g|webp|svg)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default "";',loader:'js'}));}};
await build({entryPoints:[join(temporary,'entry.ts')],outfile:join(temporary,'entry.js'),bundle:true,format:'esm',sourcemap:true,plugins:[plugin]});
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>B source review</title><link rel="icon" href="data:,"><style>
:root{--panel:#0b1422;--ground:#070d17;--amber:#f2b53a;--ink:#e7eef6;--ink-2:#a6b6c9;--ink-3:#7d91a8;--rule:#25394c;--t-xs:12px;--t-sm:14px;--f-mono:monospace}*{box-sizing:border-box}body{margin:0;background:#070d17;color:#e7eef6;font:14px "Microsoft YaHei",Arial,sans-serif;padding:28px;max-width:1240px;margin:auto}${styles}</style>
<section class="explode has-3d" data-arm-explode><div class="view"><canvas class="three" tabindex="0"></canvas>
<img class="rm-watermark" data-rm-watermark src="/robomaster-wordmark.png" alt="" width="122" height="14" hidden><div class="study-transition" data-study-transition></div>
<div class="shot-heading"><span data-shot-phase></span><strong data-shot-title></strong></div>
<div class="feature-labels">${Array.from({length:3},(_,i)=>`<span data-feature-label="${i}"></span>`).join('')}</div>
<div class="path-legend" data-path-legend hidden>${Array.from({length:4},(_,i)=>`<span data-path-motor="${i}"></span>`).join('')}</div><span class="limit-caption" data-limit-caption hidden></span>
<div class="route-labels">${Array.from({length:14},(_,i)=>`<span data-route-label="${i}">${i+1}</span>`).join('')}</div></div>
<fieldset class="controls"><button data-play aria-pressed="true">暂停</button><button data-replay>重播</button><button data-assembly>恢复</button><button data-reset-view>视角</button><label class="timeline"><input type="range" min="0" max="1000" step="any" value="0" data-story-range><output data-story-time></output></label></fieldset>
<nav class="chapters">${Array.from({length:9},(_,i)=>`<button data-story-step="${i}">${i}</button>`).join('')}</nav><p class="description" data-story-description></p><details class="route-key" data-route-key hidden><summary>路径</summary><ol data-route-list></ol></details></section><script type="module" src="entry.js"></script>`;
await writeFile(join(temporary,'index.html'),html);
if(process.argv.includes('--build-only')){console.log('B_SOURCE_BUNDLE',join(temporary,'entry.js'));process.exit(0);}
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(path.startsWith('/models/'))path='/materials/models/derived/web/'+path.slice(8);
 if(path==='/robomaster-wordmark.png')path='/materials/images/derived/web/robomaster-wordmark.png';
 const file=resolve(root,'.'+path);if(relative(root,file).startsWith('..')){res.writeHead(403).end();return;}
 const stream=createReadStream(file);stream.on('error',()=>res.writeHead(404).end());res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');stream.pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/tmp/arm-study-revision/index.html`;console.log('B_SOURCE_PREVIEW',url);
if(process.argv.includes('--stills')||process.argv.includes('--limit-stills')){
 const limitMode=process.argv.includes('--limit-stills');
 const require=createRequire(import.meta.url),home=homedir();let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
 let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;if(!executablePath&&process.platform==='win32'){const cache=join(home,'AppData/Local/ms-playwright'),versions=(await readdir(cache)).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(a.slice(9))-Number(b.slice(9)));executablePath=join(cache,versions.at(-1),'chrome-win64/chrome.exe');}
 const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const directory=resolve('materials/documents/derived/audits/arm-study-20261022/'+(limitMode?'limit-render':'finale-render'));await mkdir(directory,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.armReview?.ready&&Number(document.querySelector('[data-arm-explode]').dataset.frames)>0,null,{timeout:120000});
  if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
  const start=await page.evaluate(limitMode=>limitMode?window.armReview.limitStart:window.armReview.climbStart,limitMode),frames=[];
  const times=limitMode?[-.01,.01,...[.3,.5,.64,.7,.78,.87,.94,.97,.99,.999].map(u=>u*28),28.01]:[1,3.5,12,20,28,36,38.5,38.99];
  for(const elapsed of times){
   await page.evaluate(time=>{const input=document.querySelector('[data-story-range]');input.value=String(time/window.armReview.duration*1000);input.dispatchEvent(new Event('input',{bubbles:true}));},start+elapsed);
   await page.waitForFunction(time=>Math.abs(Number(document.querySelector('[data-arm-explode]').dataset.storyTime)-time)<.001,start+elapsed,{timeout:30000});
   await page.locator('.view').screenshot({path:join(directory,`ending-${String(elapsed).replace('.','_')}.png`)});
   frames.push(await page.locator('[data-arm-explode]').evaluate(root=>({time:root.dataset.storyTime,bodyHeight:root.dataset.bodyHeight,advance:root.dataset.bodyAdvance,stageHeight:root.dataset.stageHeight,coreInside:root.dataset.coreInside,workspaceProgress:root.dataset.workspaceProgress,workspaceOpacity:root.dataset.workspaceOpacity,fade:root.querySelector('[data-study-transition]').style.opacity,watermarkHidden:root.querySelector('[data-rm-watermark]').hidden})));
  }
  await writeFile(join(directory,'render-checks.json'),JSON.stringify({created:new Date().toISOString(),errors,frames,visualReview:'pending; inspect the actual saved PNGs'},null,2));console.log('B_RENDER_STILLS',JSON.stringify({directory,errors,frames}));if(errors.length)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
