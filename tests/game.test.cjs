const {test}=require('node:test');
const assert=require('node:assert/strict');
const cases=require('../cases.js');
const {selectCases,grade,stats}=require('../engine.js');
test('case library has unique IDs, safe domains and both verdicts for each difficulty',()=>{
 assert.equal(cases.length,30);assert.equal(new Set(cases.map(c=>c.id)).size,30);
 for(const c of cases){assert.ok(!c.host||c.host.endsWith('.example'));assert.ok(c.expected.endsWith('.example'));assert.ok(c.lesson);assert.equal(typeof c.phish,'boolean');}
 for(const l of ['Foundation','Intermediate','Advanced']){const p=cases.filter(c=>c.level===l);assert.equal(p.length,10);assert.ok(p.some(c=>c.phish)&&p.some(c=>!c.phish));}
});
test('filters and count',()=>{const p=selectCases(cases,'Advanced','sms',10,()=>0);assert.ok(p.length>0);assert.ok(p.every(c=>c.level==='Advanced'&&c.type==='sms'));assert.equal(selectCases(cases,'All','All',5,()=>0).length,5);});
test('shuffle retains all cases without mutating source',()=>{const ids=cases.map(c=>c.id);const p=selectCases(cases,'All','All',30,()=>0);assert.equal(new Set(p.map(c=>c.id)).size,30);assert.deepEqual(cases.map(c=>c.id),ids);});
test('score, streak and hint penalty',()=>{assert.deepEqual(grade({phish:true},'phish',['a','a','b'],2,false),{correct:true,streak:3,points:140});assert.equal(grade({phish:false},'legit',[],0,true).points,70);assert.deepEqual(grade({phish:true},'legit',[],4,false),{correct:false,streak:0,points:0});});
test('stats and zero denominator',()=>{assert.equal(stats([]).accuracy,0);assert.deepEqual(stats([{correct:true,points:100,phish:true},{correct:false,points:0,phish:true},{correct:false,points:0,phish:false}]),{total:3,correct:1,accuracy:33,score:100,missed:1,falseAlarms:1});});
