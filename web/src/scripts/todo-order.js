let todoDrag=null,todoFrame=0;

function moveTodo(id,to){
  const {card}=findCard(activeCardId)??{};
  const from=card?.todos.findIndex(todo=>todo.id===id)??-1;
  if(from<0||to<0||to>=card.todos.length||to===from)return;
  const [todo]=card.todos.splice(from,1);
  card.todos.splice(to,0,todo);
  save();patchCard(card.id);renderTodos();
  const handle=$('todoList').querySelector(`[data-todo="${CSS.escape(id)}"] .todo-handle`);
  handle?.focus({preventScroll:true});handle?.scrollIntoView({block:'nearest'});
  $('todoAnnounce').textContent=`${todo.title||'未命名子任務'}移至第 ${to+1} 步，共 ${card.todos.length} 步`;
}

// Find the first row with a midpoint below the pointer, including the slot after the last row.
function todoInsertionSlot(rows,y){
  let start=0,end=rows.length;
  while(start<end){
    const middle=Math.floor((start+end)/2),box=rows[middle].getBoundingClientRect();
    if(y<box.top+box.height/2)end=middle;else start=middle+1;
  }
  return start;
}

function updateTodoDrop(scroll){
  const d=todoDrag,panel=$('modalPanel'),box=panel.getBoundingClientRect();
  const rows=$('todoList').children;
  let marker=null,edge='';d.target=null;
  if(d.x>=box.left&&d.x<=box.right&&d.y>=box.top&&d.y<=box.bottom){
    if(scroll){const speed=edgeSpeed(d.y,box.top,box.bottom,46);if(speed)panel.scrollTop+=speed;}
    const slot=todoInsertionSlot(rows,d.y),target=slot>d.from?slot-1:slot;
    if(target!==d.from){
      d.target=target;
      marker=rows[slot]??rows[rows.length-1];edge=slot===rows.length?'after':'before';
    }
  }
  if(d.marker===marker&&d.edge===edge)return;
  d.marker?.removeAttribute('data-todo-drop');
  marker?.setAttribute('data-todo-drop',edge);
  d.marker=marker;d.edge=edge;
}

function tickTodoDrag(){updateTodoDrop(true);todoFrame=requestAnimationFrame(tickTodoDrag);}

function finishTodoDrag(cancel){
  const d=todoDrag;if(!d)return;
  todoDrag=null;cancelAnimationFrame(todoFrame);
  d.row.removeAttribute('data-todo-sorting');d.marker?.removeAttribute('data-todo-drop');
  if(d.handle.hasPointerCapture(d.pointerId))d.handle.releasePointerCapture(d.pointerId);
  if(!cancel&&d.target!==null)moveTodo(d.row.dataset.todo,d.target);
}

const todoList=$('todoList');
todoList.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||todoDrag)return;
  const handle=e.target.closest('.todo-handle');if(!handle||handle.disabled)return;
  e.preventDefault();handle.focus({preventScroll:true});
  const row=handle.closest('[data-todo]');
  const from=findCard(activeCardId)?.card.todos.findIndex(todo=>todo.id===row.dataset.todo)??-1;
  if(from<0)return;
  handle.setPointerCapture(e.pointerId);
  todoDrag={handle,row,from,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:false,target:null};
});
todoList.addEventListener('pointermove',e=>{
  const d=todoDrag;if(!d||d.pointerId!==e.pointerId)return;
  d.x=e.clientX;d.y=e.clientY;
  if(d.active||Math.hypot(d.x-d.startX,d.y-d.startY)<5)return;
  d.active=true;d.row.setAttribute('data-todo-sorting','');tickTodoDrag();
});
todoList.addEventListener('pointerup',e=>{
  const d=todoDrag;if(!d||d.pointerId!==e.pointerId)return;
  if(d.active){d.x=e.clientX;d.y=e.clientY;updateTodoDrop(false);}
  finishTodoDrag(false);
});
for(const type of ['pointercancel','lostpointercapture'])todoList.addEventListener(type,e=>{if(todoDrag?.pointerId===e.pointerId)finishTodoDrag(true);});
window.addEventListener('blur',()=>finishTodoDrag(true));
$('cardDialog').addEventListener('close',()=>finishTodoDrag(true));
todoList.addEventListener('keydown',e=>{
  if(todoDrag||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.isComposing||!['ArrowUp','ArrowDown'].includes(e.key))return;
  const handle=e.target.closest('.todo-handle');if(!handle||handle.disabled)return;
  const id=handle.closest('[data-todo]').dataset.todo;
  const from=findCard(activeCardId)?.card.todos.findIndex(todo=>todo.id===id)??-1;
  e.preventDefault();if(from>=0)moveTodo(id,from+(e.key==='ArrowUp'?-1:1));
});
