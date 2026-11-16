/* Run with `node verify.cjs`. No dependencies or browser are needed.
 * This harness checks application logic with a minimal DOM adapter. It does
 * not claim to verify actual rendering, pointer hardware or browser storage.
 */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const desktop=process.argv.includes('--desktop');
// web/index.html 是 web/src 的組裝結果；直接執行時先確認沒有過期或被手動修改。
if(require.main===module&&!desktop){const web=require('./build.cjs');if(fs.readFileSync(web.OUT,'utf8')!==web.build()){console.error('web/index.html 與 web/src 不一致：請執行 node web/build.cjs，不要直接修改 web/index.html。');process.exit(1);}}
const html=fs.readFileSync(require('node:path').join(__dirname,desktop?'../desktop/app/index.html':'index.html'),'utf8');
const script=desktop?fs.readFileSync(require('node:path').join(__dirname,'../desktop/app/renderer.js'),'utf8'):html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const KEY='shixu.studio.board.v1',BACKUP=KEY+'.previous',THEME='shixu.studio.theme';
class ClassList{
  constructor(){this.values=new Set();}
  add(...values){values.forEach(x=>this.values.add(x));}
  remove(...values){values.forEach(x=>this.values.delete(x));}
  contains(value){return this.values.has(value);}
  toggle(value,force){const on=force??!this.contains(value);on?this.add(value):this.remove(value);return on;}
}
class Element{
  constructor(){this.value='';this.innerHTML='';this.textContent='';this.hidden=false;this.open=false;this.dataset={};this.style={};this.classList=new ClassList();this.events={};this.children=[];this.scrollLeft=0;this.scrollTop=0;this.scrollHeight=40;this.validity={valid:true};}
  addEventListener(event,fn){(this.events[event]??=[]).push(fn);}
  dispatch(event,data){for(const fn of this.events[event]||[])fn(data);}
  querySelectorAll(){return [];}
  querySelector(){return null;}
  setAttribute(){}
  removeAttribute(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatch('close',{});}
  focus(){}
  select(){}
  append(){}
  remove(){}
  click(){}
  scrollIntoView(){}
  getBoundingClientRect(){return {left:0,top:0,right:200,bottom:120,width:200,height:120};}
  getAnimations(){return [];}
}
function boot({store=new Map(),blocked=false,quota=false,initialMode='demo',scriptSource=script,backupBlocked=false,now}={}){
  const clock={now:now??Date.now()};class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}}
  const elements=new Map(),events={},flags={blocked,quota,backupBlocked},operations={reads:[],writes:[],removes:[]};
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());if(['notesPanel','timePage'].includes(id)&&!elements.get(id).initialized){elements.get(id).hidden=true;elements.get(id).initialized=true;}return elements.get(id);};
  const document={body:new Element(),getElementById:get,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>new Element(),addEventListener:(event,fn)=>{(events[event]??=[]).push(fn);}};
  const context={document,console,Date:now===undefined?Date:ClockDate,Intl,Blob,URL,crypto:{randomUUID},CSS:{escape:x=>x},matchMedia:()=>({matches:true}),setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},innerWidth:1440,innerHeight:900,location:{reload(){}},localStorage:{getItem(key){operations.reads.push(key);if(flags.blocked||(flags.backupBlocked&&key===KEY+'.previous'))throw Error('SecurityError');return store.get(key)??null;},setItem(key,value){operations.writes.push(key);if(flags.blocked)throw Error('SecurityError');if(flags.quota&&!key.endsWith('.probe'))throw Error('QuotaExceededError');store.set(key,value);},removeItem(key){operations.removes.push(key);if(flags.blocked)throw Error('SecurityError');store.delete(key);}}};
  context.window=context;context.addEventListener=(event,fn)=>{(events[event]??=[]).push(fn);};
  if(desktop||scriptSource.includes('const storage = window.studioDesktop.storage;'))context.studioDesktop={storage:context.localStorage,getDataDirectory:()=>'/test-data',getInitialBoardMode:()=>initialMode,openDataFolder:async()=>undefined};
  vm.createContext(context);
  // Test-only instrumentation: nothing is exposed by the delivered HTML.
  const injected=scriptSource.replace(/\}\)\(\);\s*$/,`globalThis.testAPI={get state(){return state;},validate,save,makeCard,esc,matches,dateISO,cardHTML,renderBoard,openCard,closeCard,findCard,finishDrag,edgeSpeed,...(typeof addNote==='function'?{addNote,editNote,colorNote,pinNote,moveNote,deleteNote,setNotesOpen,renderNotes,findNote,resizeNote,openNoteEditor,submitNoteEditor,closeNoteEditor,finishNoteDrag,updateNoteDrag,setNoteDrag(value){noteDrag=value;}}:{}),...(typeof defaultTimeTools==='function'?{defaultTimeTools,formatTime,timerLeft,pomLeft,stopwatchElapsed,advanceTimeTools,tickTimeTools,startTimer,pauseTimer,resetTimer,startPomodoro,pausePomodoro,resetPomodoro,startStopwatch,pauseStopwatch,lapStopwatch,resetStopwatch,putAlarm,toggleAlarm,removeAlarm,dismissTimeAlerts,pauseImportedTimeTools,setTimeOpen,renderTimeTools,ringTimeAlert}:{}),...(typeof requestDeleteCard==='function'?{requestDeleteCard,requestDeleteTodo,requestDeleteList,cancelAction}:{}),get conflict(){return conflict;},get loadProblem(){return loadProblem;},setDrag(value){drag=value;},setQuery(value){query=value;},setView(value){view=value;},setFilter(value){labelFilter=value;},activate(id){activeCardId=id;}};})();`);
  vm.runInContext(injected,context);
  return {app:context.testAPI,get,store,flags,document,events,context,operations,clock};
}
module.exports={boot};
if(require.main===module){
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const json=x=>JSON.parse(JSON.stringify(x));
const event={preventDefault(){}};
test('Standalone artifact has no external runtime requests',()=>{
  assert(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html));
  assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script));
  const ids=[...html.split('<script>')[0].matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate static IDs');
});
test('First launch seeds valid data and persists it immediately',()=>{const h=boot();assert.equal(h.app.state.lists.length,4);assert.equal(h.app.state.lists.flatMap(l=>l.cards).length,10);assert.equal(h.get('saveText').textContent,'已儲存在本機');assert.deepEqual(json(h.app.validate(JSON.parse(h.store.get(KEY)))),json(h.app.state));});
test('Theme changes survive reopening without rewriting the board',()=>{
  const h=boot();
  const before=h.store.get(KEY),choice=h.get('themeChoice');
  assert.equal(choice.value,'classic');
  choice.value='whale';choice.onchange();
  assert.equal(h.document.body.dataset.theme,'whale');
  const reopened=boot({store:h.store});
  assert.equal(reopened.get('themeChoice').value,'whale');
  reopened.get('themeChoice').value='classic';reopened.get('themeChoice').onchange();
  assert.equal(boot({store:h.store}).document.body.dataset.theme,'classic');
  assert.equal(h.store.get(KEY),before);
});
test('Reopening valid board data skips the recovery snapshot and performs no startup writes',()=>{
  const seed=boot(),raw=seed.store.get(KEY),previous=seed.store.get(BACKUP);
  const h=boot({store:seed.store,backupBlocked:true});
  assert.deepEqual(h.operations.reads,[KEY,THEME]);assert.deepEqual(h.operations.writes,[]);assert.deepEqual(h.operations.removes,[]);
  assert.equal(h.store.get(KEY),raw);assert.equal(h.store.get(BACKUP),previous);
  assert.equal(h.get('saveText').textContent,'已儲存在本機');assert.equal(h.app.loadProblem,'');
});
test('Reopening does not replace the last useful recovery snapshot',()=>{
  const h=boot();h.app.state.title='下一版';h.app.save();const current=h.store.get(KEY),backup=h.store.get(BACKUP);
  for(let i=0;i<3;i++)boot({store:h.store});
  assert.equal(h.store.get(KEY),current);assert.equal(h.store.get(BACKUP),backup);
});
test('Missing primary still recovers the backup without overwriting it',()=>{
  const seed=boot(),raw=seed.store.get(KEY),store=new Map([[BACKUP,raw]]),h=boot({store});
  assert.deepEqual(h.operations.reads,[KEY,BACKUP,THEME]);assert(h.app.loadProblem);
  assert.equal(h.store.get(KEY),undefined);assert.equal(h.store.get(BACKUP),raw);assert.deepEqual(h.operations.writes,[]);
});
test('Card previews are bounded while full descriptions remain editable and searchable',()=>{
  const h=boot(),card=h.app.state.lists[0].cards[0];card.desc='a'.repeat(49000)+'完整內容在這裡';
  const rendered=h.app.cardHTML(card);assert(rendered.length<5000);assert(!rendered.includes('完整內容在這裡'));
  h.app.setQuery('完整內容在這裡');assert.equal(h.app.matches(card),true);
  h.app.openCard(card.id);assert.equal(h.get('modalDesc').value,card.desc);h.app.save();
  assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].desc,card.desc);
});
test('Board statistics reflect the full state and update when filters change',()=>{
  const h=boot();h.app.state.lists[0].cards[0].starred=true;h.app.renderBoard();
  assert.equal(h.get('allCount').textContent,10);assert.equal(h.get('starCount').textContent,1);
  h.app.setView('starred');h.app.renderBoard();assert(h.get('boardSummary').innerHTML.startsWith('<b>1</b>'));
  h.app.setQuery('沒有符合的卡片');h.app.renderBoard();assert(h.get('boardSummary').innerHTML.startsWith('<b>0</b>'));
});
test('Legacy boards migrate in memory without startup writes and retain all cards',()=>{
  const seed=boot(),legacy=json(seed.app.state);legacy.version=1;delete legacy.notes;
  const raw=JSON.stringify(legacy),h=boot({store:new Map([[KEY,raw]])});
  assert.equal(h.app.state.version,2);assert.deepEqual(json(h.app.state.notes),[]);assert.equal(h.operations.writes.length,0);
  assert.deepEqual(json(h.app.state.lists),legacy.lists);h.app.addNote();
  assert.equal(JSON.parse(h.store.get(KEY)).version,2);assert.equal(h.store.get(BACKUP),raw);
  assert.deepEqual(json(h.app.state.lists),legacy.lists);
});
test('Notes persist text, color, position and pinning across a new execution',()=>{
  const h=boot(),n=h.app.addNote();h.app.editNote(n.id,'第一行\n第二行 📝');h.app.colorNote(n.id,'green');h.app.moveNote(n.id,240,360);h.app.pinNote(n.id);
  const reopened=boot({store:h.store});assert.deepEqual(json(reopened.app.state.notes),json(h.app.state.notes));
  assert.equal(reopened.app.state.notes[0].text,'第一行\n第二行 📝');assert.equal(reopened.app.state.notes[0].pinned,true);
  assert.deepEqual(reopened.operations.reads,[KEY,THEME]);assert.deepEqual(reopened.operations.writes,[]);
});
test('Note editor creates only on completion and cancellation does not mutate data',()=>{
  const h=boot(),before=h.store.get(KEY);h.app.setNotesOpen(true);h.get('addNote').onclick();
  assert(h.get('noteDialog').open);assert.equal(h.app.state.notes.length,0);
  h.get('noteEditorText').value='取消的草稿';h.get('noteEditorCancel').onclick();assert.equal(h.store.get(KEY),before);
  h.get('addNote').onclick();h.get('noteEditorText').value='完成才建立的內容';h.get('noteEditorColor').value='pink';h.get('noteForm').onsubmit(event);
  assert.equal(h.app.state.notes.length,1);assert.equal(h.get('noteDialog').open,false);const saved=JSON.parse(h.store.get(KEY)).notes[0];assert.equal(saved.text,'完成才建立的內容');assert.equal(saved.color,'pink');assert.equal(h.get('allCount').textContent,10);
  h.app.openNoteEditor(saved.id);h.get('noteEditorText').value='不應留下的修改';h.app.closeNoteEditor();assert.equal(h.app.state.notes[0].text,'完成才建立的內容');
});
test('Editing a note commits text and color together, preserving size and location',()=>{
  const h=boot(),n=h.app.addNote('原內容','yellow');h.app.moveNote(n.id,200,300);h.app.resizeNote(n.id,420,380);h.app.openNoteEditor(n.id);
  h.get('noteEditorText').value='修改後的內容';h.get('noteEditorColor').value='blue';const writes=h.operations.writes.length;assert(h.app.submitNoteEditor());
  const saved=JSON.parse(h.store.get(KEY)).notes[0];assert.equal(saved.text,'修改後的內容');assert.equal(saved.color,'blue');assert.equal(saved.x,200);assert.equal(saved.width,420);assert.equal(h.operations.writes.slice(writes).filter(key=>key===KEY).length,1);
});
test('A failed editor save retains the draft and retry does not create a duplicate',()=>{
  const h=boot();h.app.openNoteEditor();h.get('noteEditorText').value='磁碟恢復後再存';h.flags.quota=true;
  assert.equal(h.app.submitNoteEditor(),false);assert(h.get('noteDialog').open);assert.equal(h.app.state.notes.length,1);assert.equal(JSON.parse(h.store.get(KEY)).notes.length,0);
  h.flags.quota=false;assert(h.app.submitNoteEditor());assert.equal(JSON.parse(h.store.get(KEY)).notes.length,1);assert.equal(h.get('noteDialog').open,false);
});
test('Notes occupy their own page and returning preserves the card board',()=>{
  const h=boot(),lists=json(h.app.state.lists);h.app.setNotesOpen(true);assert.equal(h.get('kanbanPage').hidden,true);assert.equal(h.get('notesPanel').hidden,false);assert.equal(h.get('workspaceCrumb').textContent,'便簽看板');
  h.app.setNotesOpen(false);assert.equal(h.get('kanbanPage').hidden,false);assert.equal(h.get('notesPanel').hidden,true);assert.deepEqual(json(h.app.state.lists),lists);
});
test('New notes find empty space instead of appearing underneath pinned notes',()=>{
  const h=boot(),first=h.app.addNote();h.app.pinNote(first.id);const second=h.app.addNote();
  assert(second.x>=first.x+272||second.y>=first.y+258);
});
test('Note workspace renders only when opened and escapes plain text safely',()=>{
  const h=boot(),n=h.app.addNote();h.app.editNote(n.id,'</textarea><img src=x onerror="alert(1)">');
  assert.equal(h.get('notesCanvas').innerHTML,'');h.app.setNotesOpen(true);
  assert(h.get('notesCanvas').innerHTML.includes('&lt;/textarea&gt;&lt;img'));
  assert(!h.get('notesCanvas').innerHTML.includes('<img src='));assert.equal(h.get('notesEmpty').hidden,true);
  h.app.setNotesOpen(false);assert.equal(h.get('notesPanel').hidden,true);
});
test('Note deletion requires confirmation, supports cancellation and restores exact content',()=>{
  const h=boot(),n=h.app.addNote();h.app.editNote(n.id,'要保留的想法');h.app.pinNote(n.id);const expected=json(n);
  h.app.deleteNote(n.id);assert(h.get('actionDialog').open);assert.equal(h.app.state.notes.length,1);
  h.get('actionCancel').onclick();assert.equal(h.app.state.notes.length,1);
  h.app.deleteNote(n.id);h.get('actionForm').onsubmit(event);assert.equal(h.app.state.notes.length,0);assert.equal(JSON.parse(h.store.get(KEY)).notes.length,0);
  h.get('toastUndo').onclick();assert.deepEqual(json(h.app.state.notes),[expected]);assert.deepEqual(JSON.parse(h.store.get(KEY)).notes,[expected]);
});
test('First note and pinned notes can move and resize, including keyboard control',()=>{
  const h=boot(),n=h.app.addNote();h.app.pinNote(n.id);assert(h.app.moveNote(n.id,500,600));assert.equal(n.x,500);assert.equal(n.y,600);
  assert(h.app.resizeNote(n.id,440,340));assert.equal(n.width,440);assert.equal(n.height,340);
  assert(h.app.moveNote(n.id,-100,99999));assert.equal(n.x,0);assert.equal(n.y,6000);
  const handle={dataset:{noteDrag:n.id}};h.get('notesCanvas').dispatch('keydown',{target:{closest:()=>handle},key:'ArrowRight',shiftKey:true,preventDefault(){}});assert.equal(n.x,30);
  const grip={dataset:{noteResize:n.id}};h.get('notesCanvas').dispatch('keydown',{target:{closest:()=>grip},key:'ArrowRight',preventDefault(){}});assert.equal(n.width,450);
  const reopened=boot({store:h.store});assert.equal(reopened.app.state.notes[0].width,450);assert.equal(reopened.app.state.notes[0].x,30);assert.equal(h.app.moveNote(n.id,NaN,10),false);
  h.app.resizeNote(n.id,-5,9999);assert.equal(n.width,220);assert.equal(n.height,1000);
});
test('Legacy notes without dimensions keep their text and get the original default size',()=>{
  const h=boot(),n=h.app.addNote('舊便簽');const legacy=json(h.app.state);delete legacy.notes[0].width;delete legacy.notes[0].height;
  const store=new Map([[KEY,JSON.stringify(legacy)]]),opened=boot({store});assert.equal(opened.app.state.notes[0].width,260);assert.equal(opened.app.state.notes[0].height,246);assert.equal(opened.app.state.notes[0].text,n.text);assert.equal(opened.operations.writes.length,0);
});
test('Resizing commits once on release while cancellation restores the previous size',()=>{
  const h=boot(),n=h.app.addNote(),element=h.get('noteElement'),handle={releasePointerCapture(){}};
  const gesture=()=>({id:n.id,mode:'resize',element,handle,pointerId:7,startX:10,startY:10,x:n.x,y:n.y,nextX:n.x,nextY:n.y,width:260,height:246,nextWidth:260,nextHeight:246,scrollX:0,scrollY:0,moved:false});
  const before=h.store.get(KEY);h.app.setNoteDrag(gesture());h.app.updateNoteDrag({pointerId:7,clientX:90,clientY:70,preventDefault(){}});h.app.finishNoteDrag(true);assert.equal(h.store.get(KEY),before);assert.equal(n.width,260);
  const writes=h.operations.writes.length;h.app.setNoteDrag(gesture());h.app.updateNoteDrag({pointerId:7,clientX:90,clientY:70,preventDefault(){}});h.app.finishNoteDrag();assert.equal(n.width,340);assert.equal(n.height,306);assert.equal(h.operations.writes.slice(writes).filter(key=>key===KEY).length,1);
});
test('Note dragging saves once on release and cancellation preserves the original position',()=>{
  const h=boot(),n=h.app.addNote(),element=h.get('noteElement'),handle={releasePointerCapture(){}};
  const drag=()=>({id:n.id,element,handle,pointerId:7,startX:10,startY:10,x:n.x,y:n.y,nextX:n.x,nextY:n.y,scrollX:0,scrollY:0,moved:false});
  const before=h.store.get(KEY),writes=h.operations.writes.length;
  h.app.setNoteDrag(drag());h.app.updateNoteDrag({pointerId:7,clientX:90,clientY:70,preventDefault(){}});
  assert.equal(h.store.get(KEY),before);h.app.finishNoteDrag(true);assert.equal(h.store.get(KEY),before);assert.equal(n.x,20);
  h.app.setNoteDrag(drag());h.app.updateNoteDrag({pointerId:7,clientX:90,clientY:70,preventDefault(){}});h.app.finishNoteDrag();
  assert.equal(n.x,100);assert.equal(n.y,80);assert.equal(h.operations.writes.slice(writes).filter(key=>key===KEY).length,1);
  assert.equal(JSON.parse(h.store.get(KEY)).notes[0].x,100);
});
test('Note validation rejects malformed imports, duplicate IDs and unsafe colors or positions',()=>{
  const h=boot();h.app.addNote();const valid=json(h.app.state);
  for(const mutate of [s=>delete s.notes,s=>s.notes={},s=>s.notes=[null],s=>s.notes[0].text='x'.repeat(10001),s=>s.notes[0].id=s.lists[0].id,s=>s.notes[0].color='yellow;background:red',s=>s.notes[0].color='__proto__',s=>s.notes[0].pinned='true',s=>s.notes[0].x=-1,s=>s.notes[0].x=1.2,s=>s.notes[0].y=Infinity,s=>s.notes[0].y=6001,s=>s.notes[0].width=219,s=>s.notes[0].width=901,s=>s.notes[0].width='300',s=>s.notes[0].height=179,s=>s.notes[0].height=1001]){
    const bad=json(valid);mutate(bad);assert.throws(()=>h.app.validate(bad));
  }
  valid.notes[0].untrusted='ignore';assert.equal(h.app.validate(valid).notes[0].untrusted,undefined);
});
test('Note limits and storage failures keep persisted data recoverable',()=>{
  const h=boot(),n=h.app.addNote(),before=h.store.get(KEY);h.flags.quota=true;
  assert.equal(h.app.editNote(n.id,'未儲存'),false);assert.equal(h.store.get(KEY),before);assert.equal(h.get('notesSaveStatus').textContent,'尚未儲存，請匯出備份');
  h.flags.quota=false;assert(h.app.save());assert.equal(JSON.parse(h.store.get(KEY)).notes[0].text,'未儲存');
  const limited=boot();for(let i=0;i<100;i++)limited.app.state.notes.push({id:'note-'+i,text:'',color:'yellow',x:0,y:0,pinned:false});
  limited.app.addNote();assert.equal(limited.app.state.notes.length,100);assert.doesNotThrow(()=>limited.app.validate(limited.app.state));
  limited.app.state.notes.push({id:'excess',text:'',color:'yellow',x:0,y:0,pinned:false});assert.throws(()=>limited.app.validate(limited.app.state));
});
if(desktop)test('Clean portable first launch is empty and reopening preserves subsequent work',()=>{const h=boot({initialMode:'empty'});assert.equal(h.app.state.lists.length,0);assert.equal(h.app.state.title,'我的看板');h.app.state.lists.push({id:randomUUID(),title:'我的第一個列表',color:'#a393cf',cards:[h.app.makeCard('自己的卡片')]});h.app.save();const reopened=boot({store:h.store,initialMode:'empty'});assert.equal(reopened.app.state.lists.length,1);assert.equal(reopened.app.state.lists[0].cards[0].title,'自己的卡片');});
test('A new execution restores lists, order, card content, tags and checklist state',()=>{
  const h=boot(),s=h.app.state;s.title='持續記憶';s.lists.reverse();s.lists[0].cards.reverse();const card=s.lists[0].cards[0];card.title='重新開啟仍在';card.desc='已記錄的內容';card.labels=['pink','blue'];card.starred=true;card.due='2028-12-31';card.cover='orbit';card.todos=[{id:randomUUID(),title:'已完成',done:true},{id:randomUUID(),title:'未完成',done:false}];h.app.save();const expected=json(h.app.state);const reloaded=boot({store:h.store});const actual=json(reloaded.app.state);delete expected.revision;delete expected.updatedAt;delete actual.revision;delete actual.updatedAt;assert.deepEqual(actual,expected);
});
test('Every board/card input handler writes immediately',()=>{
  const h=boot(),c=h.app.state.lists[0].cards[0];h.app.activate(c.id);
  h.get('boardTitle').oninput({target:{value:'新看板名稱'}});assert.equal(JSON.parse(h.store.get(KEY)).title,'新看板名稱');
  h.get('modalTitle').oninput({target:{value:'新卡片名稱'}});assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].title,'新卡片名稱');
  h.get('modalDesc').oninput({target:{value:'即時儲存內容'}});assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].desc,'即時儲存內容');
  h.get('modalDue').onchange({target:{value:'2028-11-04',validity:{valid:true}}});assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].due,'2028-11-04');
  h.get('modalLabels').onclick({target:{closest:()=>({dataset:{label:'pink'}})}});assert(JSON.parse(h.store.get(KEY)).lists[0].cards[0].labels.includes('pink'));
  h.get('coverOptions').onclick({target:{closest:()=>({dataset:{cover:'landscape'}})}});assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].cover,'landscape');
  h.get('modalStar').onclick();assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].starred,true);
});
test('Checklist add, rename, check, delete and undo all persist',()=>{
  const h=boot(),c=h.app.state.lists[0].cards[0];h.app.activate(c.id);h.get('todoInput').value='新的子任務';h.get('todoForm').onsubmit(event);assert.equal(c.todos.length,1);const t=c.todos[0];
  h.get('todoList').dispatch('input',{target:{classList:{contains:()=>true},closest:()=>({dataset:{todo:t.id},querySelector:()=>null}),value:'已修改'}});
  h.get('todoList').dispatch('change',{target:{classList:{contains:()=>true},closest:()=>({dataset:{todo:t.id}}),checked:true}});
  let persisted=JSON.parse(h.store.get(KEY)).lists[0].cards[0].todos[0];assert.equal(persisted.title,'已修改');assert.equal(persisted.done,true);
  h.get('todoList').onclick({target:{closest:()=>({dataset:{deleteTodo:t.id}})}});assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].todos.length,1);h.get('actionForm').onsubmit(event);assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].todos.length,0);
  h.get('toastUndo').onclick();assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards[0].todos[0].done,true);
});
test('Checklist keyboard moves persist the full steps in their new order',()=>{
  const h=boot(),card=h.app.state.lists[0].cards[1];h.app.activate(card.id);
  const before=json(card.todos),moved=before.at(-1);
  const move=(id,key)=>h.get('todoList').dispatch('keydown',{...event,key,target:{closest:()=>({closest:()=>({dataset:{todo:id}})})}});
  move(moved.id,'ArrowUp');
  const expected=[...before];expected.splice(expected.length-2,0,expected.pop());
  assert.deepEqual(json(card.todos),expected);
  assert.match(h.get('todoAnnounce').textContent,/移至第/);
  assert.deepEqual(json(boot({store:h.store}).app.findCard(card.id).card.todos),expected);
  const raw=h.store.get(KEY);move(expected[0].id,'ArrowUp');assert.equal(h.store.get(KEY),raw);
});
test('Moving and duplicating a card preserve nested data with unique IDs',()=>{
  const h=boot(),source=h.app.state.lists[0],target=h.app.state.lists[1],card=source.cards[1];h.app.activate(card.id);h.get('modalMove').onchange({target:{value:target.id}});assert(!source.cards.includes(card));assert.equal(target.cards.at(-1),card);h.get('duplicateCard').onclick();const copy=target.cards.at(-1);assert.notEqual(copy.id,card.id);assert.notEqual(copy.todos[0].id,card.todos[0].id);assert.deepEqual(copy.labels,card.labels);assert.doesNotThrow(()=>h.app.validate(JSON.parse(h.store.get(KEY))));
});
test('Dropped cards commit cross-list and within-list ordering',()=>{
  const h=boot(),source=h.app.state.lists[0],target=h.app.state.lists[1],card=source.cards[0],anchor=target.cards[1];
  const placeholder={closest:()=>({dataset:{listId:target.id}}),nextElementSibling:{dataset:{cardId:anchor.id}}};
  h.app.setDrag({kind:'card',id:card.id,placeholder,ghost:{remove(){}}});h.app.finishDrag();assert.equal(target.cards[1],card);assert(!source.cards.includes(card));
  h.app.setDrag({kind:'card',id:card.id,placeholder:{closest:()=>({dataset:{listId:target.id}}),nextElementSibling:null},ghost:{remove(){}}});h.app.finishDrag();assert.equal(target.cards.at(-1),card);assert.equal(JSON.parse(h.store.get(KEY)).lists[1].cards.at(-1).id,card.id);
});
test('List drag persists DOM order; cancelling does not mutate state',()=>{
  const h=boot(),[a,b,c,d]=h.app.state.lists,placeholder={};const list=l=>({dataset:{listId:l.id},classList:{contains:()=>true}});h.get('board').children=[list(b),list(c),placeholder,list(d)];
  h.app.setDrag({kind:'list',id:a.id,placeholder,ghost:{remove(){}}});h.app.finishDrag();assert.deepEqual(json(h.app.state.lists.map(l=>l.id)),[b.id,c.id,a.id,d.id]);
  const saved=h.store.get(KEY);h.app.setDrag({kind:'list',id:a.id,placeholder,ghost:{remove(){}}});h.app.finishDrag(true);assert.equal(h.store.get(KEY),saved);
});
test('Edge scrolling works in both directions and stops in the center',()=>{const h=boot();assert(h.app.edgeSpeed(3,0,500)<0);assert.equal(h.app.edgeSpeed(250,0,500),0);assert(h.app.edgeSpeed(497,0,500)>0);});
test('Previous valid snapshot is retained after a mutation',()=>{const h=boot(),before=h.store.get(KEY);h.app.state.title='新版';h.app.save();assert.equal(h.store.get(BACKUP),before);assert.equal(JSON.parse(h.store.get(KEY)).title,'新版');});
test('Corrupt primary recovers the previous snapshot without overwriting either',()=>{
  const h=boot();h.app.state.title='可復原';h.app.save();h.app.state.title='最新版';h.app.save();h.store.set(KEY,'{broken');const previous=h.store.get(BACKUP);const recovered=boot({store:h.store});assert.equal(recovered.app.state.title,'可復原');assert(recovered.app.loadProblem);assert.equal(h.store.get(KEY),'{broken');assert.equal(h.store.get(BACKUP),previous);assert.equal(recovered.get('notice').hidden,false);assert.equal(recovered.get('saveText').textContent,'尚未儲存');
});
test('Corrupt primary and backup preserve raw data and show a warning',()=>{const store=new Map([[KEY,'bad'],[BACKUP,'bad backup']]),h=boot({store});assert(h.app.loadProblem);assert.equal(store.get(KEY),'bad');assert.equal(store.get(BACKUP),'bad backup');assert.equal(h.app.save(),false);});
test('SecurityError and quota errors never claim the data is saved',()=>{
  const blocked=boot({blocked:true});assert.equal(blocked.get('saveText').textContent,'尚未儲存');assert.equal(blocked.get('notice').hidden,false);
  const h=boot(),saved=h.store.get(KEY);h.flags.quota=true;h.app.state.title='尚未寫入';assert.equal(h.app.save(),false);assert.equal(h.store.get(KEY),saved);assert.equal(h.get('saveText').textContent,'尚未儲存');h.flags.quota=false;assert.equal(h.app.save(),true);assert.equal(JSON.parse(h.store.get(KEY)).title,'尚未寫入');
});
test('Concurrent window changes are detected and cannot be silently overwritten',()=>{const h=boot(),external=JSON.parse(h.store.get(KEY));external.title='其他視窗';h.store.set(KEY,JSON.stringify(external));h.app.state.title='此視窗';assert.equal(h.app.save(),false);assert.equal(h.app.conflict,true);assert.equal(JSON.parse(h.store.get(KEY)).title,'其他視窗');assert.equal(h.get('noticeResolve').hidden,false);});
test('A storage clear event pauses writes and keeps in-memory work recoverable',()=>{const h=boot();h.events.storage[0]({key:null});assert.equal(h.app.conflict,true);assert.equal(h.app.save(),false);assert.equal(h.get('notice').hidden,false);});
test('Invalid backup schemas, duplicate IDs, labels and dates are rejected',()=>{
  const h=boot(),valid=json(h.app.state);assert.doesNotThrow(()=>h.app.validate(valid));
  for(const mutate of [s=>s.version=99,s=>s.lists[0].cards[0].todos=null,s=>s.lists[1].id=s.lists[0].id,s=>s.labels[0].id='unknown',s=>s.lists[0].cards[0].labels=['pink','pink'],s=>s.lists[0].cards[0].due='2027-02-30',s=>s.lists[0].cards[0].cover='evil',s=>s.lists[0].color='red;display:none',s=>s.lists[0].cards[0].todos=[{id:'x',title:'t',done:'true'}]]){const bad=json(valid);mutate(bad);assert.throws(()=>h.app.validate(bad));}
});
test('User-supplied HTML is escaped and unexpected import fields are stripped',()=>{const h=boot();assert.equal(h.app.esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');const s=json(h.app.state);s.untrusted='extra';s.lists[0].cards[0].untrusted='extra';const clean=h.app.validate(s);assert.equal(clean.untrusted,undefined);assert.equal(clean.lists[0].cards[0].untrusted,undefined);});
test('Search, favorites, tag filters and seven-day due window are composable',()=>{const h=boot(),c=h.app.state.lists[0].cards[0];h.app.setQuery('不存在的內容');assert.equal(h.app.matches(c),false);h.app.setQuery('好點子');assert.equal(h.app.matches(c),true);h.app.setQuery('');h.app.setView('starred');assert.equal(h.app.matches(c),false);c.starred=true;assert.equal(h.app.matches(c),true);h.app.setFilter('pink');assert.equal(h.app.matches(c),false);h.app.setFilter(null);h.app.setView('week');c.due=h.app.dateISO(6);assert.equal(h.app.matches(c),true);c.due=h.app.dateISO(7);assert.equal(h.app.matches(c),false);c.due=h.app.dateISO(-1);assert.equal(h.app.matches(c),false);});
test('Board view tabs count all, starred and seven-day cards',()=>{const h=boot(),cards=h.app.state.lists.flatMap(l=>l.cards);cards.forEach(c=>{c.starred=false;c.due='';});cards[0].starred=cards[1].starred=true;cards[2].due=h.app.dateISO(0);cards[3].due=h.app.dateISO(6);cards[4].due=h.app.dateISO(7);cards[5].due=h.app.dateISO(-1);h.app.renderBoard();assert.equal(h.get('tabAllCount').textContent,cards.length);assert.equal(h.get('allCount').textContent,cards.length);assert.equal(h.get('starCount').textContent,2);assert.equal(h.get('weekCount').textContent,2);h.app.setView('week');h.app.renderBoard();assert.equal(h.get('weekCount').textContent,2);assert.equal(h.get('tabAllCount').textContent,cards.length);});
test('Deleting a card and using undo restores the complete card',()=>{const h=boot(),list=h.app.state.lists[0],card=list.cards[1],before=json(card);h.app.activate(card.id);h.get('deleteCard').onclick();assert(h.app.findCard(card.id));h.get('actionForm').onsubmit(event);assert(!h.app.findCard(card.id));/* closeCard resolves on a microtask, so the async test below checks undo. */assert.equal(JSON.parse(h.store.get(KEY)).lists[0].cards.length,2);});
(async()=>{
  const h=boot(),list=h.app.state.lists[0],card=list.cards[1],before=json(card);h.app.activate(card.id);h.get('deleteCard').onclick();await h.get('actionForm').onsubmit(event);h.get('toastUndo').onclick();assert.deepEqual(json(h.app.findCard(card.id).card),before);passed++;console.log('PASS Card delete undo restores nested checklist and labels');
  const invalid=boot(),raw=invalid.store.get(KEY);await invalid.get('importFile').onchange({target:{files:[{size:3,text:async()=>'{x'}],value:'x'}});assert.equal(invalid.store.get(KEY),raw);passed++;console.log('PASS Invalid JSON import leaves current data unchanged');
  const imported=json(h.app.state);imported.title='匯入測試';await h.get('importFile').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({board:imported})}],value:'x'}});assert(h.get('actionDialog').open);assert.notEqual(h.app.state.title,'匯入測試');h.get('actionForm').onsubmit(event);assert.equal(JSON.parse(h.store.get(KEY)).title,'匯入測試');h.get('toastUndo').onclick();assert.equal(JSON.parse(h.store.get(KEY)).title,'日常，靈感與計畫');passed++;console.log('PASS Valid import requires confirmation, persists and supports undo');
  const memo=boot(),n=memo.app.addNote();memo.app.editNote(n.id,'和看板一起備份');memo.app.moveNote(n.id,123,456);memo.app.resizeNote(n.id,420,360);memo.app.pinNote(n.id);const snapshot=json(memo.app.state);
  const target=boot();await target.get('importFile').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({board:snapshot})}],value:'x'}});target.get('actionForm').onsubmit(event);assert.deepEqual(JSON.parse(target.store.get(KEY)).notes,snapshot.notes);passed++;console.log('PASS JSON backup import restores complete notes and positions');
  const legacy=json(snapshot);legacy.version=1;delete legacy.notes;await target.get('importFile').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({board:legacy})}],value:'x'}});assert(target.get('actionDescription').textContent.includes('清空目前便簽'));target.get('actionForm').onsubmit(event);assert.equal(target.app.state.notes.length,0);target.get('toastUndo').onclick();assert.deepEqual(json(target.app.state.notes),snapshot.notes);passed++;console.log('PASS Legacy backup replacement warns about notes and undo restores them');
  console.log(`\n${passed} checks passed. Browser visual/pointer QA remains separate.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
}
