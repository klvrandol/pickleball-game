// Optional: Playwright + Chromium required. Tests dist unchanged; endpoint fixtures use a
// separate temporary production build containing test-only state access (never published).
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const {preview,build}=await import('vite');let browser,server,fixtureServer,temp;
 const errors=[],badResponses=[],failed=[];
 try{
  server=await preview({preview:{host:'127.0.0.1',port:4301,strictPort:true}});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({locale:'en-US',viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+(m.location().url||''));});
  page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')failed.push(`${r.url()}: ${r.failure()?.errorText}`);});
  const base='http://127.0.0.1:4301/pickleball-game/';
  const readyTitle=()=>page.waitForSelector('#title-root[data-ready=true]',{timeout:60000});
  const readyMatch=()=>page.waitForFunction(()=>document.querySelector('#match-overlay')?.hidden&&!document.querySelector('#serve')?.disabled,{},{timeout:60000});
  await page.goto(base);await readyTitle();assert.equal(await page.locator('h1').innerText(),'PICKLE COURT');
  for(const name of ['Ranger','Rogue','Barbarian','Mage'])for(const suffix of ['','-sports']){const response=await page.request.get(base+`models/${name}${suffix}.glb`);assert.equal(response.status(),200);assert.equal((await response.body()).toString('ascii',0,4),'glTF');}
  for(const file of ['ASSET-CREDITS.md','licenses/THREE-LICENSE.txt','licenses/KAYKIT-ADVENTURERS-LICENSE.txt'])assert.equal((await page.request.get(base+file)).status(),200);
  await page.locator('#open-settings').click();await page.locator('[data-language-select]').selectOption('ko');await page.waitForFunction(()=>document.documentElement.lang==='ko');assert.match(await page.locator('#open-help').innerText(),/조작 방법/);await page.locator('#close-panel').click();await page.reload();await readyTitle();assert.equal(await page.locator('html').getAttribute('lang'),'ko');
  await page.locator('#open-settings').click();await page.locator('[data-language-select]').selectOption('en');await page.locator('#close-panel').click();await page.locator('#open-help').click();assert.match(await page.locator('dialog').innerText(),/volley/);await page.keyboard.press('Escape');
  await page.screenshot({path:'/tmp/pages-title.png'});
  console.log('PASS dist: real Pages subpath, 8 public models, embedded textures, credits, language persistence/title/help');
  for(const mode of ['singles','doubles']){
   await page.locator('#start-'+mode).click();await readyMatch();assert.equal(await page.locator('.player-nameplate').count(),mode==='singles'?2:4);
   await page.locator('#serve').click();await page.waitForFunction(()=>{const label=document.querySelector('#readiness');if(label?.textContent.includes('Green')){document.querySelector('#court').dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));return true;}return false;},{},{timeout:60000});
   await page.waitForFunction(()=>Number(document.querySelector('#rally').textContent)>=1,{},{timeout:15000});
   await page.locator('#pause').click();const before=await page.locator('.score').allTextContents();await page.locator('#pause-overlay [data-language-select]').selectOption('ko');await page.waitForFunction(()=>document.querySelector('.player-nameplate')?.textContent==='나');assert.deepEqual(await page.locator('.score').allTextContents(),before);await page.locator('#pause-overlay [data-language-select]').selectOption('en');await page.locator('#resume').click();
   await page.locator('#restart').click();await readyMatch();assert.deepEqual(await page.locator('.score').allTextContents(),['0','0']);await page.reload();await readyMatch();await page.screenshot({path:`/tmp/pages-${mode}.png`});
   await page.locator('#pause').click();await page.locator('#pause-overlay .return-title').click();await readyTitle();
   console.log('PASS dist:',mode,'start, native drop serve + click, pause/language, restart, reload, main menu');
  }
  // Do not add debug exports to application code or to dist. Compile identical sources
  // separately, inserting state inspection only into this ephemeral browser fixture.
  temp=await fs.mkdtemp(path.join(os.tmpdir(),'pickle-pages-fixture-'));
  await build({logLevel:'warn',build:{outDir:temp,emptyOutDir:true},plugins:[{name:'pages-test-state',enforce:'pre',transform(source,id){
   if(!/\/src\/(main|doubles)\.ts$/.test(id))return;
   const needle=/function inReach\(\)\s*\{/;assert(needle.test(source),'Test hook missing: '+id);
   const notice=id.endsWith('/main.ts')?'resultNotice':'notice';
   return source.replace(needle,signature=>`Object.assign(window,{pagesTest:{match,ball,preparePoint,setPaused,notice:${notice}}});${signature}`);
  }}]});
  fixtureServer=await preview({build:{outDir:temp},preview:{host:'127.0.0.1',port:4302,strictPort:true}});
  for(const mode of ['singles','doubles']){
   await page.goto(`http://127.0.0.1:4302/pickleball-game/${mode}.html?play=1`);await page.waitForFunction(()=>window.pagesTest&&document.querySelector('#match-overlay').hidden,{},{timeout:60000});
   await page.evaluate(()=>{const n=window.pagesTest.notice;window.advancePagesNotice=n.advance.bind(n);n.advance=()=>{};});
   for(const winner of ['player','cpu']){
    await page.evaluate(({mode,winner})=>{const x=window.pagesTest,m=x.match;x.notice.clear();m.start();m.server=winner;if(mode==='doubles'){m.serverId=winner==='player'?'ranger':'barbarian';m.serverNumber=1;}m.score[winner]=10;x.preparePoint();m.drop();if(mode==='doubles')m.serveActor(m.serverId,m.servePosition);else m.serve(m.server,m.servePosition);m.fault(winner==='player'?'cpu':'player','아웃!');m.tick(1);},{mode,winner});
    await page.waitForFunction(winner=>document.querySelector('#result-title').textContent.includes(winner==='player'?'YOU WIN!':'YOU LOSE!'),winner);assert.equal(await page.evaluate(winner=>window.pagesTest.match.score[winner],winner),11);
    if(!await page.locator('.settings').evaluate(el=>el.open))await page.locator('.settings summary').click();await page.locator('.settings [data-language-select]').selectOption('ko');await page.waitForFunction(()=>/[승리패배]/.test(document.querySelector('#result-title').textContent));await page.locator('.settings [data-language-select]').selectOption('en');
    await page.evaluate(()=>window.advancePagesNotice(3));await page.waitForFunction(()=>!document.querySelector('#match-overlay').hidden);assert.match(await page.locator('#overlay-copy').innerText(),/Final score/);assert.equal(await page.locator('#match-overlay .return-title').innerText(),'Main Menu');
    if(winner==='player'){await page.locator('#start').click();await readyMatch();assert.deepEqual(await page.locator('.score').allTextContents(),['0','0']);}
   }
   await page.locator('#match-overlay .return-title').click();await readyTitle();console.log('PASS temporary production fixture:',mode,'both match endings, translated notices, final scores, restart and title return');
  }
  assert.deepEqual(badResponses,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS no browser console errors, failed asset requests or HTTP errors. dist was not instrumented or published.');
 }finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));if(fixtureServer)await new Promise(resolve=>fixtureServer.httpServer.close(resolve));if(temp)await fs.rm(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exit(1)});
