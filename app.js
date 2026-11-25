'use strict';
const $=id=>document.getElementById(id);
const screens=['setup','game','summary'];
const storageKey='phish-or-legit.best.v1';
let queue=[],index=0,results=[],streak=0,seen=new Set(),hintUsed=false,locked=false;
let best=0;
try{const n=Number(localStorage.getItem(storageKey));if(Number.isFinite(n)&&n>=0)best=n;}catch{}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function show(id){for(const s of screens)$(s).hidden=s!==id;window.scrollTo(0,0);}
function showBest(){$('best').textContent=best.toLocaleString('en-GB')+' points';}
function updateAvailable(){const p=CASES.filter(c=>($('level').value==='All'||c.level===$('level').value)&&($('type').value==='All'||c.type===$('type').value));$('available').textContent=p.length+' matching cases · '+Math.min(p.length,Number($('count').value))+' in this session';$('start').disabled=!p.length;}
function start(list){if(!list.length)return;queue=list;index=0;results=[];streak=0;show('game');render();}
function metrics(){const s=stats(results);$('progressText').textContent=results.length+' / '+queue.length;$('score').textContent=s.score.toLocaleString('en-GB');$('streak').textContent=streak;$('accuracy').textContent=s.accuracy+'%';$('progress').max=queue.length;$('progress').value=results.length;}
const channelNames={email:'EMAIL',sms:'SMS MESSAGE',login:'LOGIN PAGE'};
function renderMessage(c){
 const root=$('message');root.replaceChildren();
 if(c.type==='email'){
  const head=el('div',undefined,'mailhead');head.append(el('h2',c.title),el('p',c.sender+' <'+c.address+'>','muted'),el('p','To: Analyst · Simulated inbox','muted'));root.append(head,el('p',c.body,'bodytext'));
  if(c.host)root.append(el('div','Link preview available in evidence inspector','artifact'));
  if(c.attachment!=='No attachment')root.append(el('div','Attachment: '+c.attachment.split(' • ')[0]+' · metadata only','artifact'));
 }else if(c.type==='sms'){
  root.append(el('h2',c.title));const phone=el('div',undefined,'phone');phone.append(el('strong',c.sender),el('p',c.address,'muted'),el('p',c.body,'bodytext'));if(c.host)phone.append(el('div','Link preview available','artifact'));root.append(phone);
 }else{
  root.append(el('h2',c.title));const browser=el('div',undefined,'browser');browser.append(el('div','https://'+c.host+'  ·  SIMULATED','address'));
  const mock=el('div',undefined,'mockpage');mock.append(el('h3',c.sender),el('p','Illustrative sign-in screen'),el('div','Account field (disabled)','placeholder'),el('div','Password field (disabled)','placeholder'),el('p',c.body,'bodytext'));browser.append(mock);root.append(browser);
 }
}
function evidence(c){return [
 {id:'domain',label:'Domain & link preview',value:'Observed host: '+(c.host||'No link supplied')+'\nExpected service: '+c.expected+'\nAll destinations are inert .example names.'},
 {id:'auth',label:'Authentication & headers',value:'Observed sender: '+c.address+'\n'+c.auth+'\nAuthentication alone cannot prove intent.'},
 {id:'attachment',label:'Attachment analysis',value:c.attachment+'\nNo files can be opened or downloaded.'},
 {id:'context',label:'Independent verification',value:c.context+'\nEvidence is simulated for this case.'}
];}
function render(){
 const c=queue[index];seen=new Set();hintUsed=false;locked=false;$('caseNumber').textContent='Case '+String(index+1).padStart(2,'0');$('channel').textContent=channelNames[c.type];$('difficulty').textContent=c.level;renderMessage(c);
 $('feedback').hidden=true;$('feedback').classList.remove('wrong');$('hintText').hidden=true;$('hint').disabled=false;$('phish').disabled=false;$('legit').disabled=false;$('evidenceOutput').textContent='Select an evidence tool to begin.';$('reviewed').textContent='0 of 4 tools reviewed';$('tools').replaceChildren();
 for(const item of evidence(c)){const b=el('button',item.label,'tool');b.type='button';b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{if(!locked)seen.add(item.id);for(const t of $('tools').children){t.classList.remove('active');t.setAttribute('aria-pressed','false');}b.classList.add('active');b.setAttribute('aria-pressed','true');if(seen.has(item.id))b.classList.add('seen');$('evidenceOutput').textContent=item.value;$('reviewed').textContent=seen.size+' of 4 tools reviewed';});$('tools').append(b);}
 metrics();
}
function verdict(v){
 if(locked)return;locked=true;const c=queue[index],g=grade(c,v,[...seen],streak,hintUsed);streak=g.streak;results.push({...g,phish:c.phish,verdict:v,c,inspected:seen.size});$('phish').disabled=true;$('legit').disabled=true;$('hint').disabled=true;
 $('feedback').hidden=false;$('feedback').classList.toggle('wrong',!g.correct);$('feedbackTitle').textContent=g.correct?'Correct verdict · +'+g.points+' points':'Incorrect verdict';$('feedbackBody').textContent=(c.phish?'This case is phishing. ':'This case is legitimate. ')+c.lesson;$('next').textContent=index+1===queue.length?'View debrief →':'Next case →';metrics();$('feedback').focus();
}
function finish(){
 if(!results.length){show('setup');return;}
 const s=stats(results);if(s.score>best){best=s.score;try{localStorage.setItem(storageKey,String(best));}catch{}}
 showBest();show('summary');$('summaryTitle').textContent=results.length===queue.length?'Investigation complete':'Session ended';$('summaryMessage').textContent=s.accuracy===100?'Every verdict was correct. Review the evidence to reinforce your skills.':s.accuracy>=70?'Good progress. Review the cases you missed to improve your detection skills.':'Review the case explanations and practise again.';
 $('summaryMetrics').replaceChildren();for(const [label,value] of [['SCORE',s.score.toLocaleString('en-GB')],['ACCURACY',s.accuracy+'%'],['CORRECT',s.correct+'/'+s.total],['MISSED PHISH',s.missed],['FALSE ALARMS',s.falseAlarms]]){const d=el('div');d.append(el('small',label),el('strong',value));$('summaryMetrics').append(d);}
 $('review').replaceChildren();for(const r of results){const row=el('div',undefined,'reviewrow');row.append(el('strong',(r.correct?'Correct · ':'Incorrect · ')+r.c.title,r.correct?'good':'bad'),el('p','Your verdict: '+(r.verdict==='phish'?'Phishing':'Legitimate')+' | Actual: '+(r.phish?'Phishing':'Legitimate')+' | Evidence: '+r.inspected+'/4 | +'+r.points+' points'),el('p',r.c.lesson));$('review').append(row);}
 $('retry').disabled=results.every(r=>r.correct);$('summaryTitle').focus();
}
for(const id of ['level','type','count'])$(id).addEventListener('change',updateAvailable);
$('start').addEventListener('click',()=>start(selectCases(CASES,$('level').value,$('type').value,Number($('count').value))));
$('hint').addEventListener('click',()=>{if(locked)return;hintUsed=true;$('hint').disabled=true;$('hintText').textContent='Focus on this signal: '+queue[index].signal;$('hintText').hidden=false;});
$('phish').addEventListener('click',()=>verdict('phish'));
$('legit').addEventListener('click',()=>verdict('legit'));
$('next').addEventListener('click',()=>{if(!locked)return;if(index+1===queue.length){finish();return;}index++;render();window.scrollTo(0,0);$('quit').focus();});
$('quit').addEventListener('click',()=>{if(window.confirm('End the current investigation?'))finish();});
$('again').addEventListener('click',()=>{show('setup');$('start').focus();});
$('retry').addEventListener('click',()=>{const missed=results.filter(r=>!r.correct).map(r=>r.c);start(selectCases(missed,'All','All',missed.length));});
$('reset').addEventListener('click',()=>{if(!window.confirm('Reset your saved personal best?'))return;best=0;try{localStorage.removeItem(storageKey);}catch{}showBest();});
showBest();updateAvailable();
