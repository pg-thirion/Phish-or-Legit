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
if(typeof module!=='undefined') module.exports={selectCases,grade,stats};
