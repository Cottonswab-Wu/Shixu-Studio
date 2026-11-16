// Custom pointer drag: retain a real-sized placeholder, FLIP the neighboring
// elements, scroll on every animation frame, and commit the data on pointer-up.
let pending=null,drag=null,suppressClick=false,dragFrame=0;
function measure(){return new Map([...$('board').querySelectorAll('.card,.list')].filter(el=>!el.classList.contains('drag-ghost')).map(el=>[el.dataset.cardId||el.dataset.listId,el.getBoundingClientRect()]));}
function animateShift(before){if(!motion())return;const elements=[...$('board').querySelectorAll('.card,.list')];elements.forEach(el=>el.getAnimations().forEach(a=>a.cancel()));const frames=[];for(const el of elements){const old=before.get(el.dataset.cardId||el.dataset.listId);if(!old)continue;const r=el.getBoundingClientRect();let dx=old.left-r.left,dy=old.top-r.top;if(el.classList.contains('card')){const parent=el.closest('.list'),previous=before.get(parent?.dataset.listId);if(previous){const box=parent.getBoundingClientRect();dx-=previous.left-box.left;dy-=previous.top-box.top;}}if(Math.abs(dx)+Math.abs(dy)>=1)frames.push({el,dx,dy});}frames.forEach(({el,dx,dy})=>el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:190,easing:'cubic-bezier(.2,.7,.2,1)'}));}
$('board').addEventListener('pointerdown',e=>{
  if(e.button!==0||drag||pending||e.target.closest('button,input,textarea,select,a'))return;
  const card=e.target.closest('.card'),header=e.target.closest('.list-header');const el=card||header?.closest('.list');if(!el)return;
  pending={el,kind:card?'card':'list',id:card?el.dataset.cardId:el.dataset.listId,x:e.clientX,y:e.clientY,pointerId:e.pointerId};
});
function beginDrag(p){
  try{$('board').setPointerCapture(p.pointerId);}catch(e){/* Mouse input still works without capture. */}
  closeMenu();const r=p.el.getBoundingClientRect(),ghost=p.el.cloneNode(true),placeholder=document.createElement('div');ghost.classList.add('drag-ghost');ghost.removeAttribute('id');ghost.removeAttribute('tabindex');ghost.setAttribute('aria-hidden','true');ghost.style.width=r.width+'px';ghost.style.height=r.height+'px';ghost.style.maxHeight='none';ghost.style.left=r.left+'px';ghost.style.top=r.top+'px';
  placeholder.className='drag-placeholder';placeholder.style.width=r.width+'px';placeholder.style.height=r.height+'px';placeholder.style.minWidth=r.width+'px';p.el.replaceWith(placeholder);document.body.append(ghost);
  drag={...p,ghost,placeholder,dx:p.x-r.left,dy:p.y-r.top,currentX:p.x,currentY:p.y,before:clone(state),originalParent:placeholder.parentElement};document.body.classList.add('dragging');suppressClick=true;dragFrame=requestAnimationFrame(dragTick);
}
document.addEventListener('pointermove',e=>{if(pending&&e.pointerId===pending.pointerId){if(Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>6){const p=pending;pending=null;beginDrag(p);}}if(drag&&e.pointerId===drag.pointerId){e.preventDefault();drag.currentX=e.clientX;drag.currentY=e.clientY;}},{passive:false});
function edgeSpeed(v,min,max,zone=60){if(v<min+zone)return -Math.min(20,Math.max(0,(min+zone-v)/zone*18));if(v>max-zone)return Math.min(20,Math.max(0,(v-(max-zone))/zone*18));return 0;}
function dragTick(){if(!drag)return;const d=drag,b=$('board'),r=b.getBoundingClientRect();d.ghost.style.left=d.currentX-d.dx+'px';d.ghost.style.top=d.currentY-d.dy+'px';
  if(d.currentY>=r.top-25&&d.currentY<=r.bottom+25){b.scrollLeft+=edgeSpeed(d.currentX,r.left,r.right,80);}
  const old=measure();let changed=false;
  if(d.kind==='list'){
    const siblings=[...b.querySelectorAll(':scope > .list')];const nearest=siblings.find(el=>{const box=el.getBoundingClientRect();return d.currentX<box.left+box.width/2;});const anchor=nearest||$('listComposer')||$('addList');if(anchor&&d.placeholder.nextElementSibling!==anchor){b.insertBefore(d.placeholder,anchor);changed=true;}
  }else{
    const list=[...b.querySelectorAll(':scope > .list')].find(el=>{const box=el.getBoundingClientRect();return d.currentX>=box.left-8&&d.currentX<=box.right+8;});
    if(list&&d.currentY>=r.top-25&&d.currentY<=r.bottom+25){const container=list.querySelector('.cards'),box=container.getBoundingClientRect();container.scrollTop+=edgeSpeed(d.currentY,box.top,box.bottom,55);const cards=[...container.querySelectorAll(':scope > .card')];const next=cards.find(el=>{const rect=el.getBoundingClientRect();return d.currentY<rect.top+rect.height/2;})||null;const atEnd=!next&&d.placeholder.parentElement===container&&![...container.children].slice([...container.children].indexOf(d.placeholder)+1).some(n=>n.classList.contains('card'));if(d.placeholder.parentElement!==container||(next&&d.placeholder.nextElementSibling!==next)||(!next&&!atEnd)){container.insertBefore(d.placeholder,next);changed=true;}}
  }
  if(changed)animateShift(old);dragFrame=requestAnimationFrame(dragTick);
}
function finishDrag(cancel=false){
  pending=null;if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(dragFrame);document.body.classList.remove('dragging');
  if(!cancel){
    if(d.kind==='list'){const order=[...$('board').children].filter(el=>el===d.placeholder||el.classList.contains('list')).map(el=>el===d.placeholder?d.id:el.dataset.listId);state.lists=order.map(id=>state.lists.find(l=>l.id===id));}
    else{const targetId=d.placeholder.closest('.list')?.dataset.listId,found=findCard(d.id),target=state.lists.find(l=>l.id===targetId);if(found&&target){const next=d.placeholder.nextElementSibling?.dataset.cardId;found.list.cards.splice(found.list.cards.indexOf(found.card),1);const index=next?target.cards.findIndex(c=>c.id===next):-1;target.cards.splice(index>=0?index:target.cards.length,0,found.card);}}
    save();
  }
  d.ghost.remove();renderBoard();const el=document.querySelector(d.kind==='card'?`.card[data-card-id="${CSS.escape(d.id)}"]`:`.list[data-list-id="${CSS.escape(d.id)}"]`);el?.focus({preventScroll:true});setTimeout(()=>suppressClick=false,50);
}
document.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pointerId)finishDrag();else pending=null;});document.addEventListener('pointercancel',()=>finishDrag(true));window.addEventListener('blur',()=>{if(drag)finishDrag(true);pending=null;});
