// Optional development integration test. Vite + Playwright + Chromium required.
// Fixture clock follows simulated frames; real-clock expiry is covered in the unit suite.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{for(const mode of ['singles','doubles']){
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(`**/src/${mode==='singles'?'main':'doubles'}.ts*`,async route=>{
   const response=await route.fetch();let code=await response.text();
   const members=mode==='singles'?'player,cpu,playerVelocity,contacts:()=>playerContact.clone()':'player,agents,positions,velocity,contacts';
   code=code.replace('function inReach() {',`window.__hitTrace=[];Object.assign(window,{t:{THREE,match,ball,hit,hitAssist,playerHitContext,playerTiming,timingVisual,reachRing,playerMotion,preparePoint,setPaused,aim,${members}}});function inReach() {`);
   const name=mode==='singles'?'contactHit':'playerContact';
   code=code.replace(`function ${name}(shot) {`,`function ${name}(shot) {window.__hitTrace.push({timing:playerTiming(playerHitContext()),point:ball.position.toArray(),shot});`);
   await route.fulfill({response,body:code});
  });
  await page.goto('http://127.0.0.1:5173/'+(mode==='doubles'?'doubles.html':'singles.html'));await page.locator('#start').click();await page.waitForFunction(()=>window.t);
  async function fixture({early=false,far=false,late=false,bounced=false,kitchen=false}={}){
   return page.evaluate(o=>{const t=window.t;t.hitAssist.clock=undefined;t.preparePoint();t.match.phase='rally';t.match.hits=3;t.match.lastHitter='cpu';t.match.bounceRequired={player:false,cpu:false};const z=o.kitchen?1.8:4;t.player.group.position.set(0,.045,z);(t.playerVelocity||t.velocity).set(0,0,0);if(t.cpu)t.cpu.position.set(-2,.045,-5);else{t.positions.rogue.set(-2,.045,6);t.positions.barbarian.set(-2,.045,-5);t.positions.mage.set(2,.045,-5);}t.aim.set(0,.05,-4.8);t.ball.launch(new t.THREE.Vector3(o.far?4:o.early?.35:o.late?.3:1.2,1.2,o.late?z+.7:o.early?z-1.8:z-.5),new t.THREE.Vector3(0,o.early?1:0,o.early?9:o.late?4:0));t.ball.bounces=o.bounced?1:0;window.__hitTrace=[];const c=t.playerHitContext();return {timing:t.playerTiming(c),position:t.ball.position.toArray()};}, {early,far,late,bounced,kitchen});
  }
  for(const shot of ['drive','dink']){
   await fixture({bounced:true});await page.evaluate(shot=>window.t.hit(shot),shot);await page.waitForFunction(()=>window.t.match.hits===4);
   const trace=await page.evaluate(()=>window.__hitTrace);assert.equal(trace.length,1);assert.equal(trace[0].shot,shot);assert.equal(trace[0].timing,'now');console.log('PASS',mode,shot,'expanded edge contact');
  }
  const early=await fixture({early:true});assert.equal(early.timing,'soon');
  const queued=await page.evaluate(()=>{const t=window.t,before=t.ball.velocity.toArray();t.hit('drive');return {before,after:t.ball.velocity.toArray(),pending:Boolean(t.hitAssist.pending),hits:t.match.hits};});assert.deepEqual(queued.before,queued.after);assert.ok(queued.pending);assert.equal(queued.hits,3);await page.waitForFunction(()=>window.t.match.hits===4);assert.equal(await page.evaluate(()=>window.__hitTrace[0].timing),'now');console.log('PASS',mode,'yellow early volley input waits for actual green contact');
  for(const bad of ['far','late']){await fixture({[bad]:true});await page.evaluate(()=>window.t.hit('drive'));assert.equal(await page.evaluate(()=>window.t.hitAssist.pending),null);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__hitTrace.length),0);console.log('PASS',mode,bad,'click still misses');}
  await fixture({kitchen:true});await page.evaluate(()=>window.t.hit('drive'));await page.waitForFunction(()=>window.t.match.phase==='settling');assert.match(await page.evaluate(()=>window.t.match.pending.reason),/키친/);console.log('PASS',mode,'kitchen volley still faults');
  // Hold a safe, legal volley sample for the rendered green cue screenshot.
  await fixture({bounced:false});await page.evaluate(()=>{const t=window.t;t.ball.position.set(.65,1.7,3.6);t.ball.velocity.set(0,.1,0);});await page.waitForFunction(()=>window.t.reachRing.material.color.getHex()===0x60f59a);await page.screenshot({path:`/tmp/player-timing-${mode}.png`});assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
