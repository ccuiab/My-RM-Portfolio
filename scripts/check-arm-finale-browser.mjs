/** Watch B's ending run continuously through its real loop. Connects to an
 * existing source-review harness, records the rendered page, and retains source
 * hashes plus screenshots; it never recompiles the shared harness. */
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,join,relative} from 'node:path';
import {homedir} from 'node:os';
const url=process.argv.find(x=>x.startsWith('--url='))?.slice(6);if(!url)throw new Error('Pass --url=<running B source harness>');
const root=resolve('.'),out=resolve('materials/documents/derived/audits/arm-study-20261022/finale-continuous');await mkdir(out,{recursive:true});
const required=['tmp/arm-study-revision/entry.js','tmp/arm-study-revision/index.html','src/scripts/arm-explode-scene.ts','src/scripts/arm-study-story.ts','src/scripts/lib/arm-study-finale.ts','materials/models/derived/web/arm-parts.json','materials/models/derived/web/arm-context.json','materials/models/derived/web/arm-wrist-transmission.json','materials/images/derived/web/robomaster-wordmark.png'];
const sha=b=>createHash('sha256').update(b).digest('hex'),sources=Object.fromEntries(await Promise.all(required.map(async path=>[path,sha(await readFile(path))])));
const sourceMap=JSON.parse(await readFile('tmp/arm-study-revision/entry.js.map','utf8')),canonical=text=>sha(text.replace(/\r\n/g,'\n'));
const compiled=[];
for(const path of required.filter(p=>p.startsWith('src/'))){const i=sourceMap.sources.findIndex(source=>resolve('tmp/arm-study-revision',source)===resolve(path));compiled.push({path,present:i>=0,matches:i>=0&&canonical(sourceMap.sourcesContent[i])===canonical(await readFile(path,'utf8'))});}
const require=createRequire(import.meta.url),home=homedir();let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;if(!executablePath&&process.platform==='win32'){const cache=join(home,'AppData/Local/ms-playwright'),versions=(await readdir(cache)).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(a.slice(9))-Number(b.slice(9)));executablePath=join(cache,versions.at(-1),'chrome-win64/chrome.exe');}
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),errors=[],samples=[],screenshots=[];
page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.armReview?.ready&&Number(document.querySelector('[data-arm-explode]').dataset.frames)>0,null,{timeout:120000});
 const info=await page.evaluate(()=>({duration:window.armReview.duration,start:window.armReview.climbStart}));
 if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
 await page.evaluate(time=>{const slider=document.querySelector('[data-story-range]');slider.value=String(time/window.armReview.duration*1000);slider.dispatchEvent(new Event('input',{bubbles:true}));},info.start-.6);
 await page.waitForFunction(time=>Math.abs(Number(document.querySelector('[data-arm-explode]').dataset.storyTime)-time)<.001,info.start-.6);
 await page.locator('[data-play]').click();
 const targets=[-.4,.2,.7,1.3,3.3,12,20,28,36,38.4,38.9],captured=new Set(),started=Date.now();let looped=false,lastTime=info.start-.6,loopFrame=null;
 while(Date.now()-started<150000){
  const row=await page.locator('[data-arm-explode]').evaluate(root=>({time:Number(root.dataset.storyTime),height:Number(root.dataset.bodyHeight),advance:Number(root.dataset.bodyAdvance),stage:Number(root.dataset.stageHeight),coreInside:root.dataset.coreInside,fade:Number(root.querySelector('[data-study-transition]').style.opacity),watermarkHidden:root.querySelector('[data-rm-watermark]').hidden,cameraPosition:root.dataset.cameraPosition,cameraTarget:root.dataset.cameraTarget}));
  samples.push(row);
  if(lastTime>info.start&&row.time<2){looped=true;loopFrame??=row;}
  if(!looped){
   for(const target of targets)if(!captured.has(target)&&row.time-info.start>=target){const name=`continuous-${String(target).replace('.','_')}.png`;await page.locator('.view').screenshot({path:join(out,name)});screenshots.push({name,requestedElapsed:target,observed:row});captured.add(target);}
  }else{
   const key=row.time<.65?'loop-fade':'loop-opening';if(!captured.has(key)){const name=key+'.png';await page.locator('.view').screenshot({path:join(out,name)});screenshots.push({name,observed:row});captured.add(key);}
   if(row.time>.9)break;
  }
  lastTime=row.time;await page.waitForTimeout(75);
 }
 if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
 const sourceChanges=[];for(const [path,hash]of Object.entries(sources))if(sha(await readFile(path))!==hash)sourceChanges.push(path);
 const report={created:new Date().toISOString(),url,info,sources,compiledSources:compiled,sourceChanges,errors,loopObserved:looped,loopFrame,wallSeconds:(Date.now()-started)/1000,samples,screenshots,visualReview:'pending; inspect saved continuous screenshots and recording before claiming visual acceptance'};
 await writeFile(join(out,'continuous-checks.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({errors,loopObserved:looped,sourceChanges,compiledSources:compiled,screenshots:screenshots.map(s=>s.name),wallSeconds:report.wallSeconds,report:join(out,'continuous-checks.json')},null,2));
 if(errors.length||!looped||sourceChanges.length||compiled.some(c=>!c.matches))process.exitCode=1;
}finally{
 const recording=page.video();await context.close();if(recording)await copyFile(await recording.path(),join(out,'continuous-ending-review.webm'));await browser.close();
}
