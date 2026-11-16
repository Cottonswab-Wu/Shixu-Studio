// Notes share board persistence; their DOM is created only on the notes page.
let noteDrag=null,noteFrame=0,noteEditorId=null,notesQuery='';
const notePosition=v=>Math.max(0,Math.min(6000,Math.round(v)));
const noteWidth=n=>n.width??260,noteHeight=n=>n.height??246;
const findNote=id=>state.notes.find(n=>n.id===id);
const shownNotes=()=>state.notes.filter(n=>!notesQuery||n.text.toLocaleLowerCase().includes(notesQuery));
function sizeNotesCanvas(){const viewport=$('notesViewport');$('notesCanvas').style.width=Math.max(viewport.clientWidth||280,...shownNotes().map(n=>n.x+noteWidth(n)+24))+'px';$('notesCanvas').style.height=Math.max(viewport.clientHeight||300,...shownNotes().map(n=>n.y+noteHeight(n)+24))+'px';}
function renderNotes(){
  $('notesCount').textContent=state.notes.length;$('addNote').disabled=state.notes.length>=100;
  if($('notesPanel').hidden)return;
  if(noteDrag)finishNoteDrag(true);
  const visible=shownNotes();$('notesEmpty').hidden=visible.length>0;
  $('notesEmpty').innerHTML=notesQuery?'找不到符合的便簽，試試其他關鍵字。':'先記下來，讓腦袋留點空間。<br>按「新增便簽」，輸入內容後按「完成」。';
  $('notesSummary').textContent=notesQuery?`${visible.length} 張符合的便簽 / 共 ${state.notes.length} 張`:`${state.notes.length} 張便簽 · 置頂便簽也能自由移動與調整大小`;
  $('notesCanvas').innerHTML=visible.map(n=>{
    const index=state.notes.indexOf(n),c=noteColors[n.color],name=`便簽 ${index+1}`;
    return `<article class="sticky-note ${n.pinned?'pinned':''}" data-note-id="${esc(n.id)}" aria-label="${name}" style="left:${n.x}px;top:${n.y}px;width:${noteWidth(n)}px;height:${noteHeight(n)}px;z-index:${n.pinned?110+index:index+1};--note-paper:${c.paper};--note-border:${c.border};--note-ink:${c.ink}">
      <div class="note-top"><button class="note-handle" data-note-drag="${esc(n.id)}" aria-label="移動${name}" title="拖曳移動，或按方向鍵微調">${icon('grip')}<span>${name}</span></button>${n.pinned?'<span class="note-pin-label">置頂</span>':''}<button class="icon-btn" data-note-pin="${esc(n.id)}" aria-pressed="${n.pinned}" aria-label="${n.pinned?'取消置頂':'置頂'}：${name}">${icon('pin')}</button><button class="icon-btn" data-note-edit="${esc(n.id)}" aria-label="編輯${name}">${icon('edit')}</button><button class="icon-btn danger" data-note-delete="${esc(n.id)}" aria-label="刪除${name}">${icon('trash')}</button></div>
      <div class="note-content" role="button" tabindex="0" data-note-edit="${esc(n.id)}" aria-label="編輯${name}內容">${esc(n.text)}</div>
      <div class="note-bottom"><span>${c.name}</span><span>${n.text.length.toLocaleString()} 字元</span></div><button class="note-resize" data-note-resize="${esc(n.id)}" aria-label="調整${name}大小" title="拖曳調整大小，或按方向鍵微調">${icon('resize')}</button></article>`;
  }).join('');
  document.title='便簽看板 · 拾序 Studio';sizeNotesCanvas();
}
function syncNotesNavigation(open){
  $('openNotes').setAttribute('aria-expanded',String(open));
  $('openNotes').classList.toggle('active',open);$('openNotes').setAttribute('aria-current',open?'page':'false');
  $('openNotesTop').hidden=open;$('closeNotes').hidden=!open;
}
function setNotesOpen(open){
  if(noteDrag)finishNoteDrag(true);
  $('timePage').hidden=true;$('openTime').classList.remove('active');$('openTime').setAttribute('aria-current','false');$('workspaceSearch').hidden=false;$('workspaceShortcuts').hidden=false;$('workspaceShortcuts').innerHTML='<i>N</i> 新增'+(open?'便簽':'卡片')+'&nbsp;&nbsp; <i>Ctrl K</i> 搜尋&nbsp;&nbsp; <i>Esc</i> 關閉視窗';
  $('notesPanel').hidden=!open;$('kanbanPage').hidden=open;
  syncNotesNavigation(open);
  $('workspaceCrumb').textContent=open?'便簽看板':'我的看板';
  $('search').value=open?notesQuery:query;$('search').placeholder=open?'搜尋便簽…':'搜尋卡片…';$('search').setAttribute('aria-label',open?'搜尋便簽':'搜尋卡片');
  closeMobile();closeMenu();renderStats();syncTimeFrame();
  if(open){renderNotes();$('addNote').focus({preventScroll:true});}else{document.title=(state.title||'我的看板')+' · 拾序 Studio';$('newCard').focus({preventScroll:true});}
}
function newNotePosition(){
  const viewport=$('notesViewport'),columns=Math.min(22,Math.max(1,Math.floor(((viewport.clientWidth||600)-40)/284)));
  const available=(x,y)=>x<=6000&&y<=6000&&!state.notes.some(n=>x<n.x+noteWidth(n)+12&&x+272>n.x&&y<n.y+noteHeight(n)+12&&y+258>n.y);
  for(let row=0;row<23;row++)for(let col=0;col<columns;col++){const x=viewport.scrollLeft+20+col*284,y=viewport.scrollTop+20+row*270;if(available(x,y))return {x,y};}
  for(let row=0;row<23;row++)for(let col=0;col<22;col++){const x=20+col*284,y=20+row*270;if(available(x,y))return {x,y};}
  return {x:20,y:20};
}
function addNote(text='',color){
  if(state.notes.length>=100){toast('目前最多支援 100 張便簽');return;}
  if(typeof text!=='string'||text.length>10000||(color!==undefined&&!Object.hasOwn(noteColors,color)))return;
  const position=newNotePosition(),note={id:uid(),text,color:color??Object.keys(noteColors)[state.notes.length%4],x:notePosition(position.x),y:notePosition(position.y),pinned:false,width:260,height:246};
  state.notes.push(note);save();renderNotes();return note;
}
function focusNote(id){const note=$('notesCanvas').querySelector(`[data-note-id="${CSS.escape(id)}"]`);note?.scrollIntoView({block:'nearest',inline:'nearest'});note?.querySelector('[data-note-edit]')?.focus({preventScroll:true});}
function openNoteEditor(id=null){
  if(noteDrag)finishNoteDrag(true);
  if(document.querySelector('dialog[open]'))return;
  const n=id?findNote(id):null;if(id&&!n)return;if(!id&&state.notes.length>=100){toast('目前最多支援 100 張便簽');return;}
  noteEditorId=id;$('noteEditorHeading').textContent=id?'編輯便簽':'新增便簽';$('noteEditorText').value=n?.text||'';$('noteEditorColor').value=n?.color||Object.keys(noteColors)[state.notes.length%4];$('noteEditorLength').textContent=$('noteEditorText').value.length.toLocaleString()+' / 10,000';$('noteEditorError').hidden=true;
  $('noteDialog').showModal();$('noteEditorText').focus();
}
function closeNoteEditor(){const id=noteEditorId;noteEditorId=null;$('noteDialog').close();if(id)focusNote(id);else $('addNote').focus();}
function submitNoteEditor(){
  const text=$('noteEditorText').value,color=$('noteEditorColor').value;
  if(!text.trim()||text.length>10000||!Object.hasOwn(noteColors,color)){$('noteEditorError').textContent='請輸入 1～10,000 字元的便簽內容，並選擇便簽顏色。';$('noteEditorError').hidden=false;$('noteEditorText').focus();return false;}
  let saved;
  if(noteEditorId){const n=findNote(noteEditorId);if(!n){$('noteEditorError').textContent='這張便簽已不存在，請取消後重新開啟。';$('noteEditorError').hidden=false;return false;}n.text=text;n.color=color;saved=save();renderNotes();}
  else{const n=addNote(text,color);if(!n)return false;noteEditorId=n.id;saved=storageOK&&!conflict&&!loadProblem;}
  if(!saved){$('noteEditorError').textContent='尚未成功儲存。內容仍保留於此視窗，請先排除儲存問題，或取消後匯出備份。';$('noteEditorError').hidden=false;return false;}
  // A newly created note must remain visible even when a previous search was active.
  notesQuery='';$('search').value='';renderNotes();closeNoteEditor();return true;
}
function editNote(id,text){const n=findNote(id);if(!n||typeof text!=='string'||text.length>10000)return false;n.text=text;const saved=save();renderNotes();return saved;}
function colorNote(id,color){const n=findNote(id);if(!n||!Object.hasOwn(noteColors,color))return false;n.color=color;const saved=save();renderNotes();return saved;}
function pinNote(id){const n=findNote(id);if(!n)return;n.pinned=!n.pinned;save();renderNotes();$('notesCanvas').querySelector(`[data-note-pin="${CSS.escape(id)}"]`)?.focus({preventScroll:true});$('notesAnnounce').textContent=n.pinned?'便簽已置頂，仍可拖曳與調整大小':'已取消便簽置頂';}
function moveNote(id,x,y){const n=findNote(id);if(!n||!Number.isFinite(x)||!Number.isFinite(y))return false;const nextX=notePosition(x),nextY=notePosition(y);if(n.x===nextX&&n.y===nextY)return false;n.x=nextX;n.y=nextY;const element=$('notesCanvas').querySelector(`[data-note-id="${CSS.escape(id)}"]`);if(element){element.style.left=n.x+'px';element.style.top=n.y+'px';}sizeNotesCanvas();save();return true;}
function resizeNote(id,width,height){const n=findNote(id);if(!n||!Number.isFinite(width)||!Number.isFinite(height))return false;const w=Math.max(220,Math.min(900,Math.round(width))),h=Math.max(180,Math.min(1000,Math.round(height)));if(noteWidth(n)===w&&noteHeight(n)===h)return false;n.width=w;n.height=h;const element=$('notesCanvas').querySelector(`[data-note-id="${CSS.escape(id)}"]`);if(element){element.style.width=w+'px';element.style.height=h+'px';}sizeNotesCanvas();save();return true;}
function deleteNote(id){
  const n=findNote(id);if(!n)return;
  const summary=n.text.trim().split('\n')[0].slice(0,60)||'空白便簽';
  ask({title:'刪除這張便簽？',description:`「${summary}」將從便簽看板移除。完成後可使用下方提示復原。`,confirm:'刪除便簽',danger:true},()=>{
    const index=state.notes.findIndex(note=>note.id===id);if(index<0)return;
    const removed=state.notes.splice(index,1)[0];save();renderNotes();$('addNote').focus();
    toast('便簽已刪除',()=>{if(state.notes.length>=100){toast('便簽已達 100 張，請先留出空間');return;}if(findNote(removed.id))return;state.notes.splice(Math.min(index,state.notes.length),0,removed);save();renderNotes();focusNote(removed.id);$('notesAnnounce').textContent='便簽已復原';});
  });
}
for(const id of ['openNotes','openNotesTop'])$(id).onclick=()=>setNotesOpen(true);
$('closeNotes').onclick=()=>setNotesOpen(false);$('addNote').onclick=()=>openNoteEditor();
$('noteForm').onsubmit=e=>{e.preventDefault();submitNoteEditor();};
$('noteEditorText').oninput=()=>{$('noteEditorLength').textContent=$('noteEditorText').value.length.toLocaleString()+' / 10,000';$('noteEditorError').hidden=true;};
$('noteEditorCancel').onclick=closeNoteEditor;$('noteEditorClose').onclick=closeNoteEditor;
$('noteDialog').addEventListener('cancel',e=>{e.preventDefault();closeNoteEditor();});
$('notesCanvas').addEventListener('click',e=>{const pin=e.target.closest('[data-note-pin]'),remove=e.target.closest('[data-note-delete]'),edit=e.target.closest('[data-note-edit]');if(pin)pinNote(pin.dataset.notePin);else if(remove)deleteNote(remove.dataset.noteDelete);else if(edit)openNoteEditor(edit.dataset.noteEdit);});
$('notesCanvas').addEventListener('keydown',e=>{
  const content=e.target.closest('.note-content[data-note-edit]');if(content&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openNoteEditor(content.dataset.noteEdit);return;}
  const handle=e.target.closest('[data-note-drag],[data-note-resize]'),delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!handle||!delta||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
  e.preventDefault();const n=findNote(handle.dataset.noteDrag||handle.dataset.noteResize);if(!n)return;
  const step=e.shiftKey?30:10;if(handle.dataset.noteResize){resizeNote(n.id,noteWidth(n)+delta[0]*step,noteHeight(n)+delta[1]*step);$('notesAnnounce').textContent=`便簽大小：${noteWidth(n)} × ${noteHeight(n)}`;}else{moveNote(n.id,n.x+delta[0]*step,n.y+delta[1]*step);$('notesAnnounce').textContent=`便簽位置：${n.x}，${n.y}`;}
});
$('notesCanvas').addEventListener('pointerdown',e=>{
  if(e.button!==0||noteDrag||document.querySelector('dialog[open]'))return;
  const handle=e.target.closest('[data-note-drag],[data-note-resize]'),n=handle&&findNote(handle.dataset.noteDrag||handle.dataset.noteResize);if(!n)return;
  e.preventDefault();handle.focus({preventScroll:true});const viewport=$('notesViewport'),element=handle.closest('.sticky-note');
  $('notesCanvas').querySelectorAll('.note-active').forEach(note=>note.classList.remove('note-active'));element.classList.add('note-active');
  noteDrag={id:n.id,mode:handle.dataset.noteResize?'resize':'move',element,handle:viewport,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y,nextX:n.x,nextY:n.y,width:noteWidth(n),height:noteHeight(n),nextWidth:noteWidth(n),nextHeight:noteHeight(n),scrollX:viewport.scrollLeft,scrollY:viewport.scrollTop,moved:false};
  // Capture on the stable workspace, not a button which can be replaced on redraw.
  try{viewport.setPointerCapture(e.pointerId);}catch(e){/* Document events retain mouse fallback. */}
});
function updateNoteDrag(e){
  if(!noteDrag||e.pointerId!==noteDrag.pointerId)return;
  e.preventDefault();const d=noteDrag,viewport=$('notesViewport'),dx=e.clientX-d.startX+viewport.scrollLeft-d.scrollX,dy=e.clientY-d.startY+viewport.scrollTop-d.scrollY;
  if(!d.moved&&Math.hypot(dx,dy)<4)return;d.moved=true;
  if(d.mode==='resize'){d.nextWidth=Math.max(220,Math.min(900,Math.round(d.width+dx)));d.nextHeight=Math.max(180,Math.min(1000,Math.round(d.height+dy)));}else{d.nextX=notePosition(d.x+dx);d.nextY=notePosition(d.y+dy);}
  if(!noteFrame)noteFrame=requestAnimationFrame(()=>{noteFrame=0;if(noteDrag!==d)return;d.element.classList.add('note-dragging');if(d.mode==='resize'){d.element.style.width=d.nextWidth+'px';d.element.style.height=d.nextHeight+'px';}else d.element.style.transform=`translate(${d.nextX-d.x}px,${d.nextY-d.y}px)`;
    $('notesCanvas').style.width=Math.max(viewport.clientWidth||280,$('notesCanvas').offsetWidth||0,d.nextX+(d.nextWidth||260)+24)+'px';$('notesCanvas').style.height=Math.max(viewport.clientHeight||300,$('notesCanvas').offsetHeight||0,d.nextY+(d.nextHeight||246)+24)+'px';});
}
function finishNoteDrag(cancel=false){
  if(!noteDrag)return;const d=noteDrag;noteDrag=null;cancelAnimationFrame(noteFrame);noteFrame=0;d.element.style.transform='';d.element.classList.remove('note-dragging');
  if(d.mode==='resize'){d.element.style.width=d.width+'px';d.element.style.height=d.height+'px';}
  try{d.handle.releasePointerCapture(d.pointerId);}catch(e){}
  if(!cancel&&d.moved){if(d.mode==='resize')resizeNote(d.id,d.nextWidth,d.nextHeight);else moveNote(d.id,d.nextX,d.nextY);$('notesAnnounce').textContent=d.mode==='resize'?'便簽大小已更新':'便簽位置已更新';}
  sizeNotesCanvas();
}
document.addEventListener('pointermove',updateNoteDrag,{passive:false});
document.addEventListener('pointerup',e=>{if(noteDrag&&e.pointerId===noteDrag.pointerId){updateNoteDrag(e);finishNoteDrag();}});
document.addEventListener('pointercancel',e=>{if(noteDrag&&e.pointerId===noteDrag.pointerId)finishNoteDrag(true);});
$('notesViewport').addEventListener('lostpointercapture',e=>{if(noteDrag&&e.pointerId===noteDrag.pointerId)finishNoteDrag(true);});
window.addEventListener('blur',()=>finishNoteDrag(true));window.addEventListener('resize',()=>{if(!$('notesPanel').hidden)sizeNotesCanvas();});

