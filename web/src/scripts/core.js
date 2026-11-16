const KEY='shixu.studio.board.v1', BACKUP=KEY+'.previous';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
const colors=[{id:'purple',name:'設計',color:'#a393cf',tint:'#eee9f7',tone:'#65508b'},{id:'blue',name:'開發',color:'#8daec8',tint:'#eaf1f7',tone:'#3e627e'},{id:'green',name:'生活',color:'#90af9c',tint:'#eaf2ed',tone:'#426852'},{id:'orange',name:'靈感',color:'#d4aa87',tint:'#f8eee5',tone:'#7f5634'},{id:'pink',name:'重要',color:'#c9919f',tint:'#f7eaee',tone:'#85445a'},{id:'yellow',name:'學習',color:'#c9bb83',tint:'#f5f1e0',tone:'#756122'}];
const covers=[{id:'',name:'無封面',color:'#f8f7fa'},{id:'orbit',name:'星軌',color:'#ded4ef'},{id:'landscape',name:'山丘',color:'#bfd0c4'},{id:'sunrise',name:'日出',color:'#eacbb6'}];
const noteColors={yellow:{name:'奶油黃',paper:'#fff4bf',border:'#e8d795',ink:'#5f4e1b'},green:{name:'薄荷綠',paper:'#e1f1e6',border:'#bed8c6',ink:'#315c42'},pink:{name:'玫瑰粉',paper:'#fbe5ed',border:'#e5c3d0',ink:'#784457'},blue:{name:'晴空藍',paper:'#e2effc',border:'#bfd5ec',ink:'#355775'}};
const TIME_DAY=86400000,TIME_STOP_MAX=604800000;
function defaultTimeTools(){return {version:1,soundEnabled:true,alarms:[],alerts:[],timer:{durationMs:300000,remainingMs:300000,deadline:null},pomodoro:{focusMs:1500000,breakMs:300000,rounds:4,autoContinue:true,phase:'focus',round:1,remainingMs:1500000,deadline:null,completed:false},stopwatch:{elapsedMs:0,startedAt:null,laps:[]}};}
function validateTimeTools(t,checkId){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),num=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max,stamp=v=>num(v,0,8640000000000000),deadline=v=>v===null||stamp(v),text=(v,max)=>typeof v==='string'&&v.length<=max;
  if(!obj(t)||t.version!==1||typeof t.soundEnabled!=='boolean'||!Array.isArray(t.alarms)||t.alarms.length>50||!Array.isArray(t.alerts)||t.alerts.length>20)throw Error('時間工具格式不正確');
  const alarms=t.alarms.map(a=>{if(!obj(a)||!text(a.label,80)||!stamp(a.at)||typeof a.enabled!=='boolean')throw Error('鬧鐘格式不正確');checkId(a.id);return {id:a.id,label:a.label,at:a.at,enabled:a.enabled};});
  const alerts=t.alerts.map(a=>{if(!obj(a)||!['alarm','pomodoro','timer','stopwatch'].includes(a.kind)||!text(a.title,120)||!text(a.message,300)||!stamp(a.at))throw Error('時間提醒格式不正確');checkId(a.id);return {id:a.id,kind:a.kind,title:a.title,message:a.message,at:a.at};});
  const c=t.timer,p=t.pomodoro,s=t.stopwatch;
  if(!obj(c)||!num(c.durationMs,1000,TIME_DAY)||!num(c.remainingMs,0,c.durationMs)||!deadline(c.deadline))throw Error('倒數計時格式不正確');
  if(!obj(p)||!num(p.focusMs,60000,10800000)||!num(p.breakMs,60000,3600000)||!num(p.rounds,1,12)||!num(p.round,1,p.rounds)||typeof p.autoContinue!=='boolean'||!['focus','break'].includes(p.phase)||!num(p.remainingMs,0,p.phase==='focus'?p.focusMs:p.breakMs)||!deadline(p.deadline)||typeof p.completed!=='boolean'||(p.completed&&(p.deadline!==null||p.remainingMs!==0)))throw Error('番茄鐘格式不正確');
  if(!obj(s)||!num(s.elapsedMs,0,TIME_STOP_MAX)||!deadline(s.startedAt)||!Array.isArray(s.laps)||s.laps.length>100)throw Error('碼表格式不正確');
  let previous=0;const laps=s.laps.map(l=>{if(!obj(l)||!num(l.totalMs,previous,TIME_STOP_MAX)||(s.startedAt===null&&l.totalMs>s.elapsedMs))throw Error('碼表計次格式不正確');checkId(l.id);previous=l.totalMs;return {id:l.id,totalMs:l.totalMs};});
  return {version:1,soundEnabled:t.soundEnabled,alarms,alerts,timer:{durationMs:c.durationMs,remainingMs:c.remainingMs,deadline:c.deadline},pomodoro:{focusMs:p.focusMs,breakMs:p.breakMs,rounds:p.rounds,autoContinue:p.autoContinue,phase:p.phase,round:p.round,remainingMs:p.remainingMs,deadline:p.deadline,completed:p.completed},stopwatch:{elapsedMs:s.elapsedMs,startedAt:s.startedAt,laps}};
}

const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
const dateISO=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const makeCard=(title,desc='',labels=[],todos=[],cover='',due='')=>({id:uid(),title,desc,labels,todos:todos.map((t,i)=>({id:uid(),title:t,done:i===0})),cover,due,starred:false});
const completedCard=(...args)=>{const card=makeCard(...args);card.todos.forEach(t=>t.done=true);return card;};
function initialState(){return {version:2,notes:[],timeTools:defaultTimeTools(),revision:0,updatedAt:new Date().toISOString(),title:'日常，靈感與計畫',labels:colors.map(({id,name})=>({id,name})),lists:[
{id:uid(),title:'靈感收集',color:'#b1a0d3',cards:[makeCard('讓每一個好點子，都有地方安放','一個屬於自己的數位工作室。收集靈感，再慢慢把它們變成現實。',['purple','orange'],[],'orbit'),makeCard('週末的城市漫遊','帶上相機，探訪一直想去的咖啡館。',['green'],['挑選路線','整理相機與鏡頭','找一間安靜的咖啡館'],'',dateISO(4)),makeCard('閱讀清單：留一點時間給自己','每天讀一點，讓思緒走遠一點。',['yellow'],['選一本想讀的書','每天閱讀 20 分鐘'])]},
{id:uid(),title:'準備開始',color:'#d8b285',cards:[makeCard('個人網站，換個新樣子','以更簡單的視覺，呈現最近的作品與想法。',['purple'],['整理參考風格','規劃首頁版面','準備作品素材'],'',dateISO(2)),makeCard('打造舒服的工作角落','一盞燈、一點綠，和喜歡的音樂。',['green','orange'],[],'landscape'),makeCard('整理這個月的學習方向','少一點分心，多一點深入。',['yellow'],['列出想學的主題','選定一個主要方向','安排每週的練習時間'])]},
{id:uid(),title:'專注進行',color:'#8dacca',cards:[makeCard('設計一個讓人想打開的看板','細節有溫度，互動有節奏。讓整理事情本身，也成為一件舒服的事。',['purple','blue'],['完成視覺設計','實作拖拽互動','確認資料自動儲存'],'',dateISO(1)),makeCard('養成每日記錄的習慣','不用很多，記下今天值得留住的一件小事。',['green'],['準備專屬筆記','記錄今天的小確幸'])]},
{id:uid(),title:'美好完成',color:'#8faf9a',cards:[makeCard('為新的開始，留一個位置','你已經準備好了。接下來，照著自己的步調前進。',['orange'],[],'sunrise'),completedCard('整理桌面，整理思緒','清出空間，也清出下一步的方向。',['green'],['收好散落的物品','清潔桌面','放上一盆小植物'])]}
]};}
// Validate the entire document before loading it. Duplicate IDs and malformed
// nested values are rejected, so imported data cannot break order or checkboxes.
function validate(s){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const str=(v,n)=>typeof v==='string'&&v.length<=n;
  if(!obj(s)||![1,2].includes(s.version)||!str(s.title,100)||!Array.isArray(s.labels)||s.labels.length!==6||!Array.isArray(s.lists)||s.lists.length>150)throw Error('備份格式或版本不符');
  const ids=new Set(), labelIds=new Set(colors.map(x=>x.id));let total=0;
  const checkId=id=>{if(!str(id,100)||!id||ids.has(id))throw Error('資料識別碼重複或無效');ids.add(id);};
  s.labels.forEach(l=>{if(!obj(l)||!labelIds.delete(l.id)||!str(l.name,30))throw Error('標籤格式不正確');});
  s.lists.forEach(l=>{if(!obj(l))throw Error('列表格式不正確');checkId(l.id);if(!str(l.title,100)||!/^#[0-9a-f]{6}$/i.test(l.color)||!Array.isArray(l.cards))throw Error('列表格式不正確');
    l.cards.forEach(c=>{if(!obj(c)||++total>10000)throw Error('卡片數量過多或格式不正確');checkId(c.id);
      if(!str(c.title,300)||!str(c.desc,50000)||!Array.isArray(c.labels)||new Set(c.labels).size!==c.labels.length||!c.labels.every(id=>colors.some(x=>x.id===id))||!covers.some(x=>x.id===c.cover)||typeof c.starred!=='boolean'||!str(c.due,10)||!Array.isArray(c.todos)||c.todos.length>1000)throw Error('卡片格式不正確');
      if(c.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.due)||c.due<'1900-01-01'||!Number.isFinite(Date.parse(c.due+'T00:00:00Z'))||new Date(c.due+'T00:00:00Z').toISOString().slice(0,10)!==c.due))throw Error('日期不正確');
      c.todos.forEach(t=>{if(!obj(t))throw Error('子任務格式不正確');checkId(t.id);if(!str(t.title,500)||typeof t.done!=='boolean')throw Error('子任務格式不正確');});
    });
  });
  if(s.version===2){
    if(!Array.isArray(s.notes)||s.notes.length>100)throw Error('便簽數量或格式不正確');
    s.notes.forEach(n=>{if(!obj(n))throw Error('便簽格式不正確');checkId(n.id);if(!str(n.text,10000)||!Object.hasOwn(noteColors,n.color)||typeof n.pinned!=='boolean'||![n.x,n.y].every(v=>Number.isInteger(v)&&v>=0&&v<=6000))throw Error('便簽內容、顏色或位置不正確');if((n.width!==undefined&&(!Number.isInteger(n.width)||n.width<220||n.width>900))||(n.height!==undefined&&(!Number.isInteger(n.height)||n.height<180||n.height>1000)))throw Error('便簽大小不正確');});
  }
  // Build a clean object rather than keeping untrusted properties.
  return {version:2,timeTools:s.version===2&&s.timeTools!==undefined?validateTimeTools(s.timeTools,checkId):defaultTimeTools(),notes:(s.version===2?s.notes:[]).map(n=>({id:n.id,text:n.text,color:n.color,x:n.x,y:n.y,pinned:n.pinned,width:n.width??260,height:n.height??246})),revision:Number.isSafeInteger(s.revision)&&s.revision>=0?s.revision:0,updatedAt:str(s.updatedAt,40)?s.updatedAt:new Date().toISOString(),title:s.title,labels:s.labels.map(l=>({id:l.id,name:l.name})),lists:s.lists.map(l=>({id:l.id,title:l.title,color:l.color,cards:l.cards.map(c=>({id:c.id,title:c.title,desc:c.desc,labels:[...c.labels],cover:c.cover,starred:c.starred,due:c.due,todos:c.todos.map(t=>({id:t.id,title:t.title,done:t.done}))}))}))};
}
let state, lastSaved=null, storageOK=true, loadProblem='', conflict=false, view='all', query='', labelFilter=null, activeCardId=null, modalOrigin=null, cardClosing=false;
let corruptRaw=null;
function load(){
  try{
    const raw=localStorage.getItem(KEY);lastSaved=raw;
    if(raw!==null){try{return validate(JSON.parse(raw));}catch(e){corruptRaw=raw;loadProblem='主要資料無法讀取。';}}
    // Only read the fallback when the primary is absent or invalid. In the
    // desktop build each storage operation is a synchronous IPC/disk request.
    const previous=localStorage.getItem(BACKUP);
    if(previous!==null){try{const recovered=validate(JSON.parse(previous));loadProblem+='已找回上一份有效資料；請先匯出備份，再按「啟用儲存」繼續。';return recovered;}catch(e){loadProblem+='上一份資料也無法讀取。';}}
    if(loadProblem){loadProblem+='原資料已保留，暫停自動儲存；可匯出目前資料或匯入有效備份。';return initialState();}
    return initialState();
  }catch(e){storageOK=false;loadProblem='瀏覽器未允許本機儲存。目前變更只留在此視窗，請匯出備份，並改以一般模式開啟。';return initialState();}
}
state=load();
function notice(message,resolveText=''){$('noticeText').textContent=message;$('notice').hidden=false;$('noticeResolve').hidden=!resolveText;$('noticeResolve').textContent=resolveText;}
function setStatus(ok){$('saveStatus').classList.toggle('error',!ok);$('saveText').textContent=ok?'已儲存在本機':'尚未儲存';$('footerStatus').textContent=ok?'離線可用 · 自動儲存已啟用':'尚未儲存 · 請查看上方提示';$('notesSaveStatus').textContent=ok?'已儲存在本機':'尚未儲存，請匯出備份';$('notesSavePill').classList.toggle('error',!ok);timeText('timeSaveStatus',ok?'已儲存在本機':'尚未儲存，請匯出備份');$('timeSavePill').classList.toggle('error',!ok);}
function save(){
  if(conflict||loadProblem){setStatus(false);return false;}
  try{
    const current=localStorage.getItem(KEY);
    if(current!==lastSaved){conflict=true;notice('另一個視窗已更新資料。為避免互相覆蓋，已暫停儲存；請先匯出此視窗需要保留的內容，再載入最新版本。','載入最新版本');setStatus(false);return false;}
    state.revision+=1;state.updatedAt=new Date().toISOString();
    const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);lastSaved=raw;storageOK=true;setStatus(true);
    // A failed backup write must not turn a successfully saved board into a failure.
    if(current!==null&&current!==raw){try{validate(JSON.parse(current));localStorage.setItem(BACKUP,current);}catch(e){/* Primary still holds the current complete state. */}}
    $('storageDetail').textContent=`目前資料：約 ${(new Blob([raw]).size/1024).toFixed(1)} KB · 版本 ${state.revision}`;
    if(!conflict)$('notice').hidden=true;
    return true;
  }catch(e){storageOK=false;setStatus(false);notice('儲存失敗：儲存空間不足或瀏覽器限制。變更仍留在此視窗，請立即匯出備份，保留之前請勿關閉。');return false;}
}
