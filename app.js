'use strict';
const $=id=>document.getElementById(id);
const screens=['setup','game','summary'];
const storageKey='phish-or-legit.best.v2';
let queue=[],index=0,results=[],streak=0,seen=new Set(),hintUsed=false,locked=false;
let best=0;let mode='practice',caseStarted=0,profile=blankProfile(),resumeData=null,sessionRecorded=false;
const profileKey='phish-or-legit.profile.v1',draftKey='phish-or-legit.draft.v1';
try{profile=cleanProfile(JSON.parse(localStorage.getItem(profileKey)),CASES);}catch{}
try{resumeData=validSnapshot(JSON.parse(localStorage.getItem(draftKey)),CASES);}catch{}
function saveProfile(){try{localStorage.setItem(profileKey,JSON.stringify(profile));}catch{}}
function clearDraft(){resumeData=null;try{localStorage.removeItem(draftKey);}catch{}$('resume').hidden=true;}
function saveDraft(){const raw={version:1,mode,ids:queue.map(c=>c.id),answers:results.map(r=>({id:r.c.id,verdict:r.verdict,seen:r.seen,hint:r.hint,confidence:r.confidence,notes:r.notes,seconds:r.seconds}))};resumeData=validSnapshot(raw,CASES);try{localStorage.setItem(draftKey,JSON.stringify(raw));}catch{}}
function config(){return {mode:$('mode').value||'practice',topic:$('topic').value||'All',level:$('level').value,type:$('type').value,count:Number($('count').value)};}
function metric(label,value){const d=el('div');d.append(el('small',label),el('strong',String(value)));return d;}
function showProfile(){const p=profile;$('lifetime').replaceChildren(metric('CASES ANALYSED',p.attempts),metric('LIFETIME ACCURACY',p.attempts?Math.round(p.correct/p.attempts*100)+'%':'0%'),metric('MASTERED',p.mastered.length+'/'+CASES.length),metric('DAILY COMPLETIONS',p.daily.length));$('achievements').replaceChildren(...achievements(p,CASES.length).map(([name,earned])=>el('div',(earned?'Unlocked: ':'Locked: ')+name,earned?'achievement earned':'achievement')));$('history').replaceChildren(...(p.history.length?p.history.map(x=>el('p',x.date+' · '+x.mode+' · '+x.correct+'/'+x.total+' correct · '+x.score+' points','historyrow')):[el('p','No completed or ended sessions yet.','muted')]));$('resume').hidden=!resumeData;$('theme').value=p.theme;$('textSize').value=p.text;$('keys').value=p.keys?'on':'off';document.documentElement?.setAttribute('data-theme',p.theme);document.documentElement?.setAttribute('data-text',p.text);}
function updateBookmark(){const saved=profile.saved.includes(queue[index].id);$('bookmark').textContent=saved?'Remove saved case':'Save case';$('bookmark').setAttribute('aria-pressed',String(saved));}
function resume(){if(!resumeData)return;const d=resumeData;queue=d.queue;results=d.results;index=results.length;streak=d.streak;mode=d.mode;sessionRecorded=false;if(index===queue.length){finish();return;}show('game');render();$('caseNumber').focus();}

try{const n=Number(localStorage.getItem(storageKey));if(Number.isInteger(n)&&n>=0&&n<=190)best=n;}catch{}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function show(id){for(const s of screens)$(s).hidden=s!==id;window.scrollTo(0,0);}
function showBest(){$('best').textContent=best.toLocaleString('en-GB')+' points / case';}
function updateAvailable(){const c=config(),daily=c.mode==='daily';for(const id of ['level','type','count','topic'])$(id).disabled=daily;const pool=chooseSession(CASES,{...c,count:CASES.length},profile);const count=daily?pool.length:Math.min(pool.length,c.count);$('available').textContent=pool.length+' matching cases · '+count+' in this session'+(daily&&profile.daily.includes(daySeed(Date.now()))?' · Already completed today':'');$('start').disabled=!count;}
function start(list,nextMode='practice'){if(!list.length)return;queue=list;index=0;results=[];streak=0;mode=nextMode;sessionRecorded=false;show('game');render();saveDraft();$('caseNumber').focus();}
function metrics(){const s=stats(results);$('progressText').textContent=results.length+' / '+queue.length;$('score').textContent=s.score.toLocaleString('en-GB');$('streak').textContent=mode==='exam'?'Hidden':streak;$('accuracy').textContent=mode==='exam'?'Hidden':s.accuracy+'%';if(mode==='exam')$('score').textContent='Hidden';$('progress').max=queue.length;$('progress').value=results.length;}
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
 {id:'domain',label:'Domain & link preview',value:'Observed host: '+(c.host||(c.type==='email'&&c.address.includes('@')?c.address.split('@').pop()+' (sender domain)':'No link supplied'))+'\nExpected service: '+c.expected+'\nAll destinations are inert .example names.'},
 {id:'auth',label:c.type==='email'?'Authentication & headers':c.type==='sms'?'Sender details':'Browser security',value:'Observed sender or origin: '+c.address+'\n'+c.auth+'\n'+(c.type==='email'?'Authentication alone cannot prove intent.':c.type==='sms'?'Sender labels may be spoofed.':'A valid TLS certificate does not establish trust.')},
 {id:'attachment',label:c.type==='email'?'Attachment analysis':'Content safety',value:c.attachment+'\nNo files can be opened or downloaded.'},
 {id:'context',label:'Independent verification',value:c.context+'\nEvidence is simulated for this case.'}
];}
function render(){
 const c=queue[index];seen=new Set();hintUsed=false;locked=false;caseStarted=Date.now();$('topicLabel').textContent=topic(c);$('notes').value='';$('notes').disabled=false;$('noteCount').textContent='0 / 300 characters';$('confidence').value='medium';$('confidence').disabled=false;updateBookmark();const d=hostDetails(c);$('domainParts').textContent=d.host?'Host: '+d.host+'\nRegistered domain: '+d.registered+'\nSubdomain: '+(d.subdomain||'None')+'\nExpected registered domain matches: '+(d.matches?'Yes':'No'):'No domain supplied.';$('domainBreakdown').open=false;$('domainBreakdown').hidden=mode==='exam';$('caseNumber').textContent='Case '+String(index+1).padStart(2,'0');$('channel').textContent=channelNames[c.type];$('difficulty').textContent=c.level;renderMessage(c);
 $('feedback').hidden=true;$('feedback').classList.remove('wrong');$('hintText').hidden=true;$('hint').disabled=mode==='exam';$('phish').disabled=false;$('legit').disabled=false;$('evidenceOutput').textContent='Select an evidence tool to begin.';$('reviewed').textContent='0 of 4 tools reviewed';$('tools').replaceChildren();
 for(const item of evidence(c)){const b=el('button',item.label,'tool');b.type='button';b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{if(!locked)seen.add(item.id);for(const t of $('tools').children){t.classList.remove('active');t.setAttribute('aria-pressed','false');}b.classList.add('active');b.setAttribute('aria-pressed','true');if(seen.has(item.id))b.classList.add('seen');$('evidenceOutput').textContent=item.value;$('reviewed').textContent=seen.size+' of 4 tools reviewed';});$('tools').append(b);}
 metrics();
}
function verdict(v){
 if(locked)return;locked=true;const c=queue[index],g=grade(c,v,[...seen],streak,hintUsed);streak=g.streak;results.push({...g,phish:c.phish,verdict:v,c,inspected:seen.size,seen:[...seen],hint:hintUsed,confidence:$('confidence').value,notes:($('notes').value||'').slice(0,300),seconds:Math.max(0,Math.round((Date.now()-caseStarted)/1000))});$('notes').disabled=true;$('confidence').disabled=true;saveDraft();$('phish').disabled=true;$('legit').disabled=true;$('hint').disabled=true;
 $('feedback').hidden=false;$('feedback').classList.toggle('wrong',mode!=='exam'&&!g.correct);$('feedbackTitle').textContent=mode==='exam'?'Verdict recorded':g.correct?'Correct verdict · +'+g.points+' points':'Incorrect verdict';$('feedbackBody').textContent=mode==='exam'?'Results are revealed at the end of the exam.':(c.phish?'This case is phishing. ':'This case is legitimate. ')+c.lesson;$('responseTip').textContent=mode==='exam'?'':c.phish?'Recommended response: report through the approved security channel and verify independently.':'Recommended response: follow normal procedures and continue to verify unexpected requests.';$('next').textContent=index+1===queue.length?'View debrief →':'Next case →';metrics();$('feedback').focus();
}
function finish(){
 clearDraft();if(!results.length){show('setup');showProfile();updateAvailable();$('start').focus();return;}if(!sessionRecorded){profile=recordSession(profile,results,mode,results.length===queue.length);saveProfile();sessionRecorded=true;}showProfile();
 const s=stats(results);const average=Math.round(s.score/s.total);if(mode==='practice'&&results.length===queue.length&&average>best){best=average;try{localStorage.setItem(storageKey,String(best));}catch{}}
 showBest();show('summary');$('summaryTitle').textContent=results.length===queue.length?'Investigation complete':'Session ended';$('summaryMessage').textContent=s.accuracy===100?'Every verdict was correct. Review the evidence to reinforce your skills.':s.accuracy>=70?'Good progress. Review the cases you missed to improve your detection skills.':'Review the case explanations and practise again.';
 $('summaryMetrics').replaceChildren();for(const [label,value] of [['SCORE',s.score.toLocaleString('en-GB')],['ACCURACY',s.accuracy+'%'],['CORRECT',s.correct+'/'+s.total],['MISSED PHISH',s.missed],['FALSE ALARMS',s.falseAlarms]]){const d=el('div');d.append(el('small',label),el('strong',value));$('summaryMetrics').append(d);}
 $('reviewFilter').value='all';renderReview();renderBreakdowns();
 $('retry').disabled=results.every(r=>r.correct);$('summaryTitle').focus();
}
function renderReview(){const filter=$('reviewFilter').value||'all';const list=results.filter(r=>filter==='all'||filter==='wrong'&&!r.correct||filter==='right'&&r.correct||filter==='phish'&&r.phish||filter==='legit'&&!r.phish);$('review').replaceChildren();if(!list.length)$('review').append(el('p','No matching cases.','muted'));for(const r of list){const row=el('div',undefined,'reviewrow');row.append(el('strong',(r.correct?'Correct · ':'Incorrect · ')+r.c.title,r.correct?'good':'bad'),el('p','Your verdict: '+(r.verdict==='phish'?'Phishing':'Legitimate')+' | Actual: '+(r.phish?'Phishing':'Legitimate')+' | Evidence: '+r.inspected+'/4 | +'+r.points+' points'),el('p','Confidence: '+r.confidence+' · '+r.seconds+' seconds'+(r.hint?' · Hint used':'')),el('p',r.c.lesson));if(r.notes)row.append(el('p','Your notes: '+r.notes));$('review').append(row);}}
function renderBreakdowns(){$('breakdowns').replaceChildren();for(const [key,title] of [['type','Channel'],['level','Difficulty'],['topic','Topic']]){const section=el('section');section.append(el('h3',title));for(const b of breakdown(results,key)){const bar=el('progress');bar.max=100;bar.value=b.accuracy;bar.setAttribute('aria-label',b.name+' accuracy');section.append(el('p',b.name+' · '+b.correct+'/'+b.total+' ('+b.accuracy+'%)'),bar);}$('breakdowns').append(section);}const c=confidenceStats(results);$('confidenceSummary').textContent='Average decision time: '+c.averageSeconds+' seconds · High-confidence errors: '+c.highWrong+'/'+c.high;}
for(const id of ['level','type','count','mode','topic'])$(id).addEventListener('change',updateAvailable);
$('start').addEventListener('click',()=>{if(resumeData&&!window.confirm('Replace your unfinished session?'))return;const c=config();start(chooseSession(CASES,c,profile),c.mode);});
$('resume').addEventListener('click',resume);
$('bookmark').addEventListener('click',()=>{const id=queue[index].id;profile.saved=profile.saved.includes(id)?profile.saved.filter(x=>x!==id):[...profile.saved,id];saveProfile();updateBookmark();});
$('notes').addEventListener('input',()=>{$('noteCount').textContent=($('notes').value||'').length+' / 300 characters';});
$('reviewFilter').addEventListener('change',renderReview);
$('print').addEventListener('click',()=>window.print());
for(const [id,key] of [['theme','theme'],['textSize','text'],['keys','keys']])$(id).addEventListener('change',()=>{profile[key]=key==='keys'?$(id).value==='on':$(id).value;saveProfile();showProfile();});
document.addEventListener?.('keydown',ev=>{if(!profile.keys||$('game').hidden||ev.altKey||ev.ctrlKey||ev.metaKey||ev.repeat||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(ev.target?.tagName))return;const key=ev.key.toLowerCase(),button=key==='p'?$('phish'):key==='l'?$('legit'):key==='n'&&locked?$('next'):/^[1-4]$/.test(key)?$('tools').children[Number(key)-1]:null;if(button&&!button.disabled){ev.preventDefault();button.click();}});
$('hint').addEventListener('click',()=>{if(locked||mode==='exam')return;hintUsed=true;$('hint').disabled=true;$('hintText').textContent='Focus on this signal: '+queue[index].signal;$('hintText').hidden=false;});
$('phish').addEventListener('click',()=>verdict('phish'));
$('legit').addEventListener('click',()=>verdict('legit'));
$('next').addEventListener('click',()=>{if(!locked)return;if(index+1===queue.length){finish();return;}index++;render();window.scrollTo(0,0);$('caseNumber').focus();});
$('quit').addEventListener('click',()=>{if(window.confirm('End the current investigation?'))finish();});
$('again').addEventListener('click',()=>{show('setup');showProfile();updateAvailable();$('start').focus();});
$('retry').addEventListener('click',()=>{const missed=results.filter(r=>!r.correct).map(r=>r.c);start(selectCases(missed,'All','All',missed.length));});
$('reset').addEventListener('click',()=>{if(!window.confirm('Reset all locally saved training progress, preferences and unfinished sessions?'))return;best=0;profile=blankProfile();clearDraft();try{localStorage.removeItem(storageKey);localStorage.removeItem(profileKey);}catch{}showBest();showProfile();updateAvailable();});
showBest();showProfile();updateAvailable();
