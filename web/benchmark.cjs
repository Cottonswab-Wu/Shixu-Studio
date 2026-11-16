'use strict';
// Logic/HTML-generation benchmark only; not a browser paint or EXE launch metric.
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {boot}=require('./verify.cjs');
const KEY='shixu.studio.board.v1';
const baseline=process.argv[2];
const sources={current:undefined};
if(baseline)sources.before=fs.readFileSync(path.resolve(baseline),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const scenarios=[{cards:1000,description:4000},{cards:10000,description:100}];
for(const scenario of scenarios){
  const seed=boot().app.state;seed.version=1;delete seed.notes;
  seed.lists.forEach(list=>{list.cards=[];});
  for(let i=0;i<scenario.cards;i++)seed.lists[i%seed.lists.length].cards.push({id:`perf-${i}`,title:`效能測試 ${i}`,desc:'x'.repeat(scenario.description),labels:[],todos:[],cover:'',due:'',starred:i%3===0});
  const raw=JSON.stringify(seed);
  for(const [name,scriptSource]of Object.entries(sources)){
    const samples=[];let result;
    for(let run=0;run<6;run++){
      const store=new Map([[KEY,raw],[KEY+'.previous',raw]]),start=performance.now();
      result=boot({store,scriptSource});const elapsed=performance.now()-start;
      if(run)samples.push(elapsed);
    }
    samples.sort((a,b)=>a-b);
    console.log(JSON.stringify({scenario,name,medianMs:Number(samples[2].toFixed(2)),htmlBytes:Buffer.byteLength(result.get('board').innerHTML),reads:result.operations.reads.length,writes:result.operations.writes.length,removes:result.operations.removes.length}));
  }
}
