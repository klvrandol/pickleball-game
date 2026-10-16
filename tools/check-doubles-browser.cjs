// Optional development smoke test: running Vite + Playwright/Chromium required.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/src/doubles.ts*',async route=>{const response=await route.fetch();let code=await response.text();code=code.replace('function startMatch() {','Object.assign(window,{d:{THREE,actors,agents,positions,match,ball,coordinator,notice,contacts,keys,velocity,preparePoint,dropServe,launchServe,hit,contactHit,stepSimulation,setPaused,aim}});function startMatch() {');await route.fulfill({response,body:code});});
await page.goto(process.env.PICKLEBALL_TEST_URL||'http://127.0.0.1:5173/doubles.html');await page.locator('#start').click();
const idle=process.argv.includes('--idle');
const report=await page.evaluate(async(idle)=>{
 const d=window.d,{teamPrediction}=await import('/src/doubles-ai.ts'),{canContact}=await import('/src/volley.ts');
 let seed=idle?77:42;for(const a of Object.values(d.agents))a.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const hits={ranger:0,rogue:0,barbarian:0,mage:0},servers={},results=[],faults={},sample=[];let maxRally=0,lastHits=0,gameFrames=0;
 for(let i=0;i<240000;i++){
  const m=d.match,b=d.ball,p=d.positions.ranger;
  if(m.phase==='over')break;
  if(m.phase==='between'){
    const r=m.doublesResult;results.push({kind:r.kind,score:{...m.score},server:m.serverId,number:m.serverNumber});faults[m.pending.reason]=(faults[m.pending.reason]||0)+1;
    d.notice.clear();d.preparePoint();lastHits=0;
  }
  if(m.phase==='ready'&&m.serverId==='ranger')d.dropServe();
  if(m.phase==='drop'&&m.serverId==='ranger'&&b.bounces===1&&canContact(p,b.position))d.hit('drive');
  d.keys.clear();
  if(m.phase==='rally'&&m.receiver==='player'){
    if(!idle&&d.coordinator.owner==='ranger'){
      const target=teamPrediction(b,p,'player',m.hits>=3&&!m.bounceRequired.player);
      if(target.x-p.x>.12)d.keys.add('KeyD');if(target.x-p.x<-.12)d.keys.add('KeyA');if(target.z-p.z>.12)d.keys.add('KeyS');if(target.z-p.z<-.12)d.keys.add('KeyW');
      if(canContact(p,b.position)&&(!m.bounceRequired.player)&&(b.bounces===1||m.hits>=3)){
        d.aim.set((i%2?1:-1)*1.5,.05,-(p.z<3.3?1.5:4.8));d.hit(p.z<3.3?'dink':'drive');
      }
    }
  }
  d.stepSimulation(1/120);gameFrames++;
  if(m.hits>lastHits){if(m.hits===1)servers[m.serverId]=(servers[m.serverId]||0)+1;else for(const id of Object.keys(d.contacts))if(d.contacts[id].time>.09){hits[id]++;break;}maxRally=Math.max(maxRally,m.hits);lastHits=m.hits;}
  if(i%1200===0)sample.push({i,phase:m.phase,call:m.scoreCall,hits:m.hits,owner:d.coordinator.owner});
 }
 return {phase:d.match.phase,winner:d.match.winner,score:d.match.score,hits,servers,maxRally,results,faults,gameFrames,sample:sample.slice(-8)};
},idle);
console.log(JSON.stringify(report,null,2));assert.equal(report.phase,'over');assert.ok(report.maxRally>=4);for(const id of ['rogue','barbarian','mage'])assert.ok(report.hits[id]>0,id+' never returned');if(!idle)assert.ok(report.results.some(r=>r.kind==='second-server'));else assert.equal(report.winner,'cpu');assert.ok(report.results.some(r=>r.kind==='sideout'));assert.deepEqual(errors,[]);await page.screenshot({path:idle?'/tmp/doubles-cpu-win.png':'/tmp/doubles-match-end.png'});await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
