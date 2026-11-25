function selectCases(cases, level, type, count, random=Math.random) {
 const pool=cases.filter(c=>(level==="All"||c.level===level)&&(type==="All"||c.type===type));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,count);
}

function grade(c,verdict,inspected,streak,hint){
 if(verdict!=="phish"&&verdict!=="legit") throw new TypeError("Invalid verdict");
 const correct=(verdict==="phish")===c.phish;
 const nextStreak=correct?streak+1:0;
 return {correct,streak:nextStreak,points:correct?Math.max(0,100+Math.min(4,new Set(inspected).size)*10+Math.min(5,streak)*10-(hint?30:0)):0};
}

function stats(results){
 const correct=results.filter(r=>r.correct).length;
 return {total:results.length,correct,accuracy:results.length?Math.round(correct/results.length*100):0,score:results.reduce((n,r)=>n+r.points,0),missed:results.filter(r=>!r.correct&&r.phish).length,falseAlarms:results.filter(r=>!r.correct&&!r.phish).length};
}

const MODES=['practice','exam','daily','weak','saved'];
const TOPICS=['All','Identity','Payments','Attachments','Messaging','Web'];
function topic(c){
 if(c.attachment!=='No attachment')return 'Attachments';
 if(/payment|invoice|purchase|bank|transaction|fee|prize|fraud/i.test(c.title+' '+c.body))return 'Payments';
 if(c.type==='login')return 'Web';
 if(/password|permission|authentication|mailbox|verification|access/i.test(c.title+' '+c.body))return 'Identity';
 return 'Messaging';
}
function daySeed(date){return new Date(date).toISOString().slice(0,10);}
function seededRandom(seed){let n=2166136261;for(const ch of String(seed))n=Math.imul(n^ch.charCodeAt(0),16777619);return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function chooseSession(cases,config,profile,date=Date.now(),random=Math.random){
 const mode=config.mode||'practice';
 if(mode==='daily')return selectCases(cases,'All','All',5,seededRandom(daySeed(date)));
 let pool=cases.filter(c=>config.topic==='All'||!config.topic||topic(c)===config.topic);
 if(mode==='weak')pool=pool.filter(c=>profile.missed.includes(c.id));
 if(mode==='saved')pool=pool.filter(c=>profile.saved.includes(c.id));
 return selectCases(pool,config.level,config.type,config.count,random);
}
function blankProfile(){return {version:1,attempts:0,correct:0,completed:0,perfect:0,missed:[],saved:[],mastered:[],history:[],daily:[],theme:'dark',text:'normal',keys:false};}
function cleanProfile(raw,cases){
 const p=blankProfile();if(!raw||raw.version!==1)return p;
 const valid=new Set(cases.map(c=>c.id)), ids=x=>Array.isArray(x)?[...new Set(x.filter(v=>valid.has(v)))]:[];
 for(const k of ['attempts','correct','completed','perfect'])p[k]=Number.isSafeInteger(raw[k])&&raw[k]>=0?Math.min(raw[k],1e9):0;
 p.correct=Math.min(p.correct,p.attempts);p.perfect=Math.min(p.perfect,p.completed);
 for(const k of ['missed','saved','mastered'])p[k]=ids(raw[k]);
 p.history=Array.isArray(raw.history)?raw.history.filter(x=>x&&MODES.includes(x.mode)&&typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isInteger(x.total)&&x.total>0&&x.total<=cases.length&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<=x.total&&Number.isInteger(x.score)&&x.score>=0&&x.score<=190*x.total).slice(0,12).map(({date,mode,total,correct,score})=>({date,mode,total,correct,score})):[];
 p.daily=Array.isArray(raw.daily)?[...new Set(raw.daily.filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(0,60):[];
 p.theme=raw.theme==='light'?'light':'dark';p.text=raw.text==='large'?'large':'normal';p.keys=raw.keys===true;
 return p;
}
function recordSession(p,results,mode,complete,date=Date.now()){
 if(!results.length)return p;
 const s=stats(results),missed=new Set(p.missed),mastered=new Set(p.mastered);
 for(const r of results){if(r.correct){missed.delete(r.c.id);mastered.add(r.c.id);}else{missed.add(r.c.id);mastered.delete(r.c.id);}}
 const day=daySeed(date);
 return {...p,attempts:p.attempts+s.total,correct:p.correct+s.correct,completed:p.completed+Number(complete),perfect:p.perfect+Number(complete&&s.accuracy===100),missed:[...missed],mastered:[...mastered],history:[{date:day,mode,total:s.total,correct:s.correct,score:s.score},...p.history].slice(0,12),daily:mode==='daily'&&complete?[...new Set([day,...p.daily])].slice(0,60):p.daily};
}
function breakdown(results,key){const groups={};for(const r of results){const k=key==='topic'?topic(r.c):r.c[key];groups[k]??=[];groups[k].push(r);}return Object.entries(groups).map(([name,rows])=>({name,...stats(rows)}));}
function achievements(p,total){return [['First investigation',p.completed>=1],['Perfect session',p.perfect>=1],['Veteran analyst',p.attempts>=100],['Case library mastered',p.mastered.length===total],['Daily investigator',p.daily.length>=5],['Consistent analyst',p.attempts>=20&&p.correct/p.attempts>=.9]];}
function confidenceStats(results){const high=results.filter(r=>r.confidence==='high');return {high:high.length,highWrong:high.filter(r=>!r.correct).length,averageSeconds:results.length?Math.round(results.reduce((s,r)=>s+(r.seconds||0),0)/results.length):0};}
function hostDetails(c){const host=c.host||(c.address.includes('@')?c.address.split('@').pop():'');const parts=host.split('.');const registered=parts.length>1?parts.slice(-2).join('.'):'';return {host,registered,subdomain:parts.length>2?parts.slice(0,-2).join('.'):'',matches:!!registered&&registered===c.expected.split('.').slice(-2).join('.')};}
function validSnapshot(raw,cases){
 if(!raw||raw.version!==1||!MODES.includes(raw.mode)||!Array.isArray(raw.ids)||!raw.ids.length||raw.ids.length>cases.length||new Set(raw.ids).size!==raw.ids.length||!Array.isArray(raw.answers)||raw.answers.length>raw.ids.length)return null;
 const byId=new Map(cases.map(c=>[c.id,c]));if(raw.ids.some(id=>!byId.has(id)))return null;
 const results=[];let streak=0;
 for(let i=0;i<raw.answers.length;i++){const a=raw.answers[i];if(!a||a.id!==raw.ids[i]||!['phish','legit'].includes(a.verdict)||!Array.isArray(a.seen)||a.seen.some(x=>!['domain','auth','attachment','context'].includes(x)))return null;const c=byId.get(a.id),g=grade(c,a.verdict,a.seen,streak,a.hint===true);streak=g.streak;results.push({...g,c,phish:c.phish,verdict:a.verdict,inspected:new Set(a.seen).size,seen:a.seen,hint:a.hint===true,confidence:['low','medium','high'].includes(a.confidence)?a.confidence:'medium',notes:typeof a.notes==='string'?a.notes.slice(0,300):'',seconds:Number.isFinite(a.seconds)?Math.max(0,Math.min(86400,Math.round(a.seconds))):0});}
 return {queue:raw.ids.map(id=>byId.get(id)),results,streak,mode:raw.mode};
}

if(typeof module!=='undefined') module.exports={selectCases,grade,stats,MODES,TOPICS,topic,daySeed,seededRandom,chooseSession,blankProfile,cleanProfile,recordSession,breakdown,achievements,confidenceStats,hostDetails,validSnapshot};
