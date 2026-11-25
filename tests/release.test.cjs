const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const source=name=>readFileSync(join(__dirname,'..',name),'utf8');
const html=source('index.html');
const cases=require('../cases.js');
const {selectCases,grade,stats}=require('../engine.js');
class Element{
 constructor(){this.children=[];this.listeners={};this.classes=new Set();this.attrs={};this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),toggle:(c,v)=>v?this.classes.add(c):this.classes.delete(c)};this.hidden=false;this.disabled=false;this.textContent='';}
 append(...n){this.children.push(...n);}
 replaceChildren(...n){this.children=n;}
 addEventListener(n,f){this.listeners[n]=f;}
 setAttribute(n,v){this.attrs[n]=v;}
 focus(){this.focused=true;}
 click(){if(!this.disabled)this.listeners.click?.();}
}
function harness(storage=new Map(),accept=true,denyStorage=false){
 const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 ids.level.value='All';ids.type.value='All';ids.count.value='30';ids.mode.value='practice';ids.topic.value='All';
 const document={getElementById:id=>ids[id],createElement:()=>new Element()};
 const window={scrollTo(){},confirm:()=>accept};
 const localStorage={getItem:k=>{if(denyStorage)throw Error('Blocked');return storage.get(k);},setItem:(k,v)=>{if(denyStorage)throw Error('Blocked');storage.set(k,v);},removeItem:k=>{if(denyStorage)throw Error('Blocked');storage.delete(k);}};
 const code=['cases.js','engine.js','app.js'].map(source).join('\n');
 const state=new Function('document','window','localStorage',code+'\nreturn {current:()=>queue[index],results:()=>results};')(document,window,localStorage);
 return {ids,state,storage};
}
test('all filters and lengths, unique cases and verdict validity',()=>{
 for(const l of ['All','Foundation','Intermediate','Advanced'])for(const t of ['All','email','sms','login'])for(const n of [5,10,20,30]){
  const p=selectCases(cases,l,t,n);assert.equal(p.length,Math.min(n,cases.filter(c=>(l==='All'||c.level===l)&&(t==='All'||c.type===t)).length));assert.equal(new Set(p.map(c=>c.id)).size,p.length);
 }
 for(const c of cases){assert.equal(grade(c,c.phish?'phish':'legit',[],0,false).points,100);assert.equal(grade(c,c.phish?'legit':'phish',[],5,false).points,0);}
 assert.throws(()=>grade(cases[0],'invalid',[],0,false),TypeError);
});
test('all cases: evidence, hints, verdict lock, scores, review, retry and local storage',()=>{
 const {ids,state,storage}=harness();ids.start.click();assert.equal(ids.game.hidden,false);const visited=new Set();
 for(let i=0;i<30;i++){
  const c=state.current();visited.add(c.id);
  assert.equal(ids.tools.children.length,4);
  for(const tool of ids.tools.children)tool.click();
  ids.tools.children[0].click();assert.equal(ids.reviewed.textContent,'4 of 4 tools reviewed');
  if(i===0)ids.hint.click();
  const correct=i!==1;ids[c.phish===correct?'phish':'legit'].click();
  ids.phish.click();ids.legit.click();assert.equal(state.results().length,i+1);
  assert.equal(ids.feedback.hidden,false);assert.equal(ids.progress.value,i+1);ids.next.click();
 }
 assert.equal(visited.size,30);assert.equal(ids.summary.hidden,false);assert.equal(ids.review.children.length,30);
 assert.equal(stats(state.results()).correct,29);assert.equal(storage.size,2);
 ids.retry.click();assert.equal(ids.progressText.textContent,'0 / 1');assert.equal(ids.game.hidden,false);
 ids.quit.click();assert.equal(ids.setup.hidden,false);const reload=harness(storage);assert.ok(reload.ids.best.textContent!=='0 points / case');reload.ids.reset.click();assert.equal(storage.size,0);
});
test('early quit, confirmation cancellation and unavailable storage',()=>{
 const a=harness(new Map(),false);a.ids.start.click();a.ids.quit.click();assert.equal(a.ids.game.hidden,false);
 const b=harness(new Map(),true,true);b.ids.count.value='5';b.ids.start.click();b.ids.quit.click();assert.equal(b.ids.setup.hidden,false);
 b.ids.start.click();b.ids.phish.click();b.ids.quit.click();assert.equal(b.ids.summary.hidden,false);assert.equal(b.storage.size,0);
 b.ids.again.click();assert.equal(b.ids.setup.hidden,false);
});
test('security invariants: no live links, forms, remote assets or network APIs',()=>{
 assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes("form-action 'none'"));assert.ok(html.includes("object-src 'none'"));
 assert.ok(!/<(?:form|input|iframe|object|embed|a)\b/i.test(html));
 assert.ok(!/(?:src|href)=["']https?:/i.test(html));
 assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|innerHTML|outerHTML|insertAdjacentHTML)\b/.test(source('app.js')));
 for(const c of cases){assert.ok(!c.host||c.host.endsWith('.example'));assert.ok(c.expected.endsWith('.example'));if(c.address.includes('@'))assert.ok(c.address.endsWith('.example'));}
});

test('training modes, topic filtering and deterministic daily challenge',()=>{
 const {chooseSession,blankProfile,topic}=require('../engine.js');
 const p=blankProfile();const config={mode:'practice',level:'All',type:'All',topic:'Payments',count:30};
 assert.ok(chooseSession(cases,config,p).every(c=>topic(c)==='Payments'));
 const d={...config,mode:'daily'};const date='2026-11-26T12:00:00Z';
 const a=chooseSession(cases,d,p,date),b=chooseSession(cases,d,p,'2026-11-26T23:00:00Z');
 assert.equal(a.length,5);assert.deepEqual(a.map(c=>c.id),b.map(c=>c.id));
 p.saved=[cases[0].id];p.missed=[cases[1].id];config.topic='All';
 assert.deepEqual(chooseSession(cases,{...config,mode:'saved'},p).map(c=>c.id),p.saved);
 assert.deepEqual(chooseSession(cases,{...config,mode:'weak'},p).map(c=>c.id),p.missed);
 assert.equal(chooseSession(cases,{...config,mode:'exam'},p).length,30);
});
test('profile validation, achievements, mastery, history, confidence and breakdowns',()=>{
 const {blankProfile,cleanProfile,recordSession,achievements,confidenceStats,breakdown,hostDetails}=require('../engine.js');
 let p=blankProfile();const c=cases[0],d=cases[1];
 const r=[{c,phish:c.phish,correct:true,points:100,confidence:'high',seconds:10},{c:d,phish:d.phish,correct:false,points:0,confidence:'high',seconds:20}];
 p=recordSession(p,r,'daily',true,'2026-11-26T12:00:00Z');
 assert.equal(p.attempts,2);assert.equal(p.correct,1);assert.equal(p.completed,1);assert.equal(p.daily.length,1);assert.deepEqual(p.missed,[d.id]);assert.deepEqual(p.mastered,[c.id]);
 assert.equal(p.history.length,1);assert.equal(achievements(p,cases.length)[0][1],true);
 assert.deepEqual(confidenceStats(r),{high:2,highWrong:1,averageSeconds:15});
 for(const key of ['type','level','topic'])assert.equal(breakdown(r,key).reduce((n,b)=>n+b.total,0),2);
 assert.equal(hostDetails(cases.find(c=>c.id==='i03')).registered,'share-notify.example');
 assert.equal(hostDetails(cases.find(c=>c.id==='i03')).matches,false);
 assert.equal(hostDetails(cases.find(c=>c.id==='i10')).matches,true);
 assert.deepEqual(cleanProfile(JSON.parse(JSON.stringify(p)),cases),p);
 assert.equal(cleanProfile({version:1,attempts:-5,correct:100,saved:['bad',c.id,c.id]},cases).attempts,0);
 assert.deepEqual(cleanProfile({version:1,saved:['bad',c.id,c.id]},cases).saved,[c.id]);
 p=recordSession(p,[{...r[1],correct:true,points:100}],'practice',true);
 assert.equal(p.missed.length,0);assert.equal(p.mastered.length,2);assert.equal(p.perfect,1);
});
test('saved session reconstruction and malformed data rejection',()=>{
 const {validSnapshot}=require('../engine.js');const c=cases[0],d=cases[1];
 const a={version:1,mode:'practice',ids:[c.id,d.id],answers:[{id:c.id,verdict:'phish',seen:['domain'],hint:false,confidence:'high',notes:'fictional',seconds:10}]};
 const snap=validSnapshot(a,cases);assert.equal(snap.results[0].points,110);assert.equal(snap.results[0].notes,'fictional');assert.equal(snap.streak,1);
 assert.equal(validSnapshot({...a,ids:[c.id,c.id]},cases),null);assert.equal(validSnapshot({...a,answers:[{...a.answers[0],id:d.id}]},cases),null);
 assert.equal(validSnapshot({...a,answers:[{...a.answers[0],seen:['bogus']}]},cases),null);
 assert.ok(validSnapshot({...a,answers:[a.answers[0],{id:d.id,verdict:'legit',seen:[]}]},cases));
});
test('exam hides feedback, notes and confidence persist after verdict, and resume works',()=>{
 const a=harness();a.ids.mode.value='exam';a.ids.count.value='5';a.ids.start.click();
 assert.equal(a.ids.hint.disabled,true);assert.equal(a.ids.domainBreakdown.hidden,true);
 a.ids.notes.value='Fictional evidence';a.ids.notes.listeners.input();assert.equal(a.ids.noteCount.textContent,'18 / 300 characters');
 a.ids.confidence.value='high';a.ids.bookmark.click();assert.equal(a.ids.bookmark.attrs['aria-pressed'],'true');
 a.ids.phish.click();assert.equal(a.ids.feedbackTitle.textContent,'Verdict recorded');assert.equal(a.ids.score.textContent,'Hidden');assert.equal(a.ids.accuracy.textContent,'Hidden');
 const b=harness(a.storage);assert.equal(b.ids.resume.hidden,false);b.ids.resume.click();
 assert.equal(b.ids.progressText.textContent,'1 / 5');assert.equal(b.state.results()[0].notes,'Fictional evidence');assert.equal(b.state.results()[0].confidence,'high');assert.equal(b.ids.hint.disabled,true);
 b.ids.quit.click();assert.equal(b.ids.summary.hidden,false);assert.equal(b.ids.breakdowns.children.length,3);
 assert.ok(b.ids.confidenceSummary.textContent.includes('High-confidence errors'));
 b.ids.reviewFilter.value='wrong';b.ids.reviewFilter.listeners.change();
 assert.ok(b.ids.review.children.length>=1);b.ids.again.click();b.ids.mode.value='saved';b.ids.mode.listeners.change();assert.equal(b.ids.start.disabled,false);b.ids.start.click();assert.equal(b.ids.progressText.textContent,'0 / 1');
});
test('daily completion and preferences persist across reload',()=>{
 const a=harness();a.ids.theme.value='light';a.ids.theme.listeners.change();a.ids.textSize.value='large';a.ids.textSize.listeners.change();a.ids.keys.value='on';a.ids.keys.listeners.change();
 a.ids.mode.value='daily';a.ids.mode.listeners.change();assert.equal(a.ids.level.disabled,true);a.ids.start.click();
 for(let i=0;i<5;i++){const c=a.state.current();a.ids[c.phish?'phish':'legit'].click();a.ids.next.click();}
 const b=harness(a.storage);assert.equal(b.ids.theme.value,'light');assert.equal(b.ids.textSize.value,'large');assert.equal(b.ids.keys.value,'on');
 b.ids.mode.value='daily';b.ids.mode.listeners.change();assert.ok(b.ids.available.textContent.includes('Already completed today'));assert.equal(b.ids.lifetime.children.length,4);assert.equal(b.ids.achievements.children.length,6);assert.equal(b.ids.history.children.length,1);
 b.ids.reset.click();assert.equal(b.storage.size,0);assert.equal(b.ids.theme.value,'dark');
});
