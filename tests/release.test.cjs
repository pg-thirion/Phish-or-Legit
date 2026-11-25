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
 ids.level.value='All';ids.type.value='All';ids.count.value='30';
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
 assert.equal(stats(state.results()).correct,29);assert.equal(storage.size,1);
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
