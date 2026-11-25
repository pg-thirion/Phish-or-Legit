import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const cases=require('../cases.js');
const base='http://127.0.0.1:8765';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const browserType of [chromium,firefox,webkit]){
  const browser=await browserType.launch({headless:true});
  try{
   for(const viewport of [{width:1440,height:900},{width:320,height:700}]){
    const page=await browser.newPage({viewport});
    const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(base+'/'))external.push(r.url());});
    await page.goto(base);
    assert.equal(await page.title(),'Phish or Legit | Threat investigation');
    await page.locator('#count').selectOption('30');
    await page.locator('#start').click();
    const visited=new Set();
    let expectedScore=0,streak=0;
    for(let i=0;i<30;i++){
     const title=await page.locator('#message h2').innerText();
     const c=cases.find(x=>x.title===title);assert.ok(c);assert.ok(!visited.has(c.id));visited.add(c.id);
     assert.equal(await page.locator('#tools button').count(),4);
     for(const tool of await page.locator('#tools button').all())await tool.click();
     assert.match(await page.locator('#reviewed').innerText(),/4 of 4/);
     await page.locator('#tools button').first().click();
     assert.match(await page.locator('#reviewed').innerText(),/4 of 4/);
     if(i===0){await page.locator('#bookmark').click();await page.locator('#notes').fill('Fictional observation');await page.locator('#confidence').selectOption('high');await page.locator('#hint').click();assert.ok(await page.locator('#hint').isDisabled());}
     const correct=i!==1;
     await page.locator((c.phish===correct)?'#phish':'#legit').click();
     expectedScore+=correct?140+Math.min(5,streak)*10-(i===0?30:0):0;
     streak=correct?streak+1:0;
     assert.ok(await page.locator('#phish').isDisabled());assert.ok(await page.locator('#legit').isDisabled());
     assert.equal(Number((await page.locator('#score').innerText()).replaceAll(',','')),expectedScore);
     assert.ok(await page.locator('#feedback').isVisible());
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
     await page.locator('#next').click();
    }
    assert.equal(visited.size,30);assert.equal(await page.locator('#review .reviewrow').count(),30);
    assert.match(await page.locator('#summaryMetrics').innerText(),/97%/);assert.equal(await page.locator('#breakdowns section').count(),3);await page.locator('#reviewFilter').selectOption('wrong');assert.equal(await page.locator('#review .reviewrow').count(),1);await page.locator('#reviewFilter').selectOption('all');assert.match(await page.locator('#review').innerText(),/Fictional observation/);
    await page.locator('#retry').click();assert.equal(await page.locator('#progressText').innerText(),'0 / 1');
    page.once('dialog',d=>d.accept());await page.locator('#quit').click();assert.ok(await page.locator('#setup').isVisible());
    await page.reload();assert.notEqual(await page.locator('#best').innerText(),'0 points / case');
    page.once('dialog',d=>d.accept());await page.locator('#reset').click();assert.equal(await page.locator('#best').innerText(),'0 points / case');
    await page.locator('#theme').selectOption('light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.locator('#textSize').selectOption('large');await page.locator('#mode').selectOption('exam');await page.locator('#level').selectOption('Advanced');await page.locator('#type').selectOption('sms');await page.locator('#start').click();
    assert.equal(await page.locator('#channel').innerText(),'SMS MESSAGE');assert.equal(await page.locator('#difficulty').innerText(),'Advanced');assert.ok(await page.locator('#hint').isDisabled());await page.locator('#phish').click();assert.equal(await page.locator('#feedbackTitle').innerText(),'Verdict recorded');await page.reload();await page.locator('#resume').click();assert.ok(await page.locator('#game').isVisible());
    assert.equal(await page.locator('input,form,a[href],iframe').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await page.close();
    console.log('PASS',browserType.name(),viewport.width,'all 30 cases, scores, retry, persistence, filtering, overflow, network isolation');
   }
  }finally{await browser.close();}
 }
}finally{server.kill();if(server.exitCode===null)await once(server,'exit');}
