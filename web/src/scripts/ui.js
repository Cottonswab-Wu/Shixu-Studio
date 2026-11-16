let toastTimer,undoAction;
function placeToast(){const parent=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if($('toast').parentElement!==parent)parent.append($('toast'));}
for(const id of ['cardDialog','noteDialog','backupDialog','labelsDialog','actionDialog'])$(id).addEventListener('close',placeToast);
function toast(message,undo){placeToast();clearTimeout(toastTimer);undoAction=undo||null;$('toastMessage').textContent=message;$('toastUndo').hidden=!undo;$('toast').hidden=false;if(!undo)toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500);}
$('toastUndo').onclick=()=>{const fn=undoAction;undoAction=null;$('toast').hidden=true;if(fn)fn();};$('toastDismiss').onclick=()=>{$('toast').hidden=true;undoAction=null;};
function openSmall(id){$(id).showModal();}
function closeMobile(){$('sidebar').classList.remove('open');$('mobileScrim').classList.remove('open');$('mobileMenu').setAttribute('aria-expanded','false');}
$('mobileMenu').onclick=()=>{$('sidebar').classList.toggle('open');$('mobileScrim').classList.toggle('open');$('mobileMenu').setAttribute('aria-expanded',String($('sidebar').classList.contains('open')));};$('mobileScrim').onclick=closeMobile;
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>$(el.dataset.close).close());
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{if(view===el.dataset.view)return;view=el.dataset.view;renderBoard();});bindTabKeys($('viewTabs'));
$('openBoard').onclick=()=>{if(!$('notesPanel').hidden)setNotesOpen(false);else if(!$('timePage').hidden)setTimeOpen(false);closeMobile();};
$('search').oninput=e=>{if(!$('notesPanel').hidden){notesQuery=e.target.value.trim().toLocaleLowerCase();renderNotes();$('notesCanvas').querySelector('.sticky-note')?.scrollIntoView({block:'nearest',inline:'nearest'});}else{query=e.target.value.trim().toLocaleLowerCase();renderBoard();}};
$('boardTitle').oninput=e=>{state.title=e.target.value;document.title=(state.title||'我的看板')+' · 拾序 Studio';save();};
$('colorFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;labelFilter=labelFilter===b.dataset.filter?null:b.dataset.filter;renderFilters();renderBoard();};
$('clearFilters').onclick=()=>{view='all';query='';labelFilter=null;$('search').value='';renderFilters();renderBoard();};
function revealAll(){if(view!=='all'||query||labelFilter){view='all';query='';labelFilter=null;$('search').value='';renderFilters();renderBoard();}}
function showComposer(listId){
  if(state.lists.reduce((n,l)=>n+l.cards.length,0)>=10000){toast('目前最多支援 10,000 張卡片');return;}
  revealAll();const list=document.querySelector(`.list[data-list-id="${CSS.escape(listId)}"]`);if(!list)return;
  const existing=list.querySelector('.composer');if(existing){existing.querySelector('textarea').focus();return;}
  const button=list.querySelector('.add-card');button.hidden=true;const form=document.createElement('form');form.className='composer';form.innerHTML=`<textarea aria-label="新卡片標題" placeholder="這次想做些什麼？" maxlength="300" rows="2" required></textarea><div class="composer-actions"><button class="btn btn-primary" type="submit">加入卡片</button><button class="icon-btn" type="button" aria-label="取消新增">${icon('close')}</button></div>`;list.append(form);form.querySelector('textarea').focus();
  const cancel=()=>{form.remove();button.hidden=false;button.focus();};form.querySelector('[type=button]').onclick=cancel;
  form.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();cancel();}if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=e=>{e.preventDefault();const title=form.querySelector('textarea').value.trim();if(!title)return;const target=state.lists.find(l=>l.id===listId);if(!target)return;if(state.lists.reduce((n,l)=>n+l.cards.length,0)>=10000){toast('目前最多支援 10,000 張卡片');return;}target.cards.push(makeCard(title));save();renderBoard();const cards=document.querySelector(`.list[data-list-id="${CSS.escape(listId)}"] .cards`);cards.scrollTop=cards.scrollHeight;toast('新想法，已加入看板');};
  list.scrollIntoView({behavior:motion()?'smooth':'instant',block:'nearest',inline:'nearest'});
}
function showListComposer(){
  if(state.lists.length>=150){toast('目前最多支援 150 個列表');return;}
  if($('listComposer')){$('listComposer').querySelector('input').focus();return;}
  const form=document.createElement('form');form.id='listComposer';form.className='list-composer composer';form.innerHTML=`<input aria-label="新列表名稱" placeholder="為這個列表取個名字…" maxlength="100" required><div class="composer-actions"><button type="submit" class="btn btn-primary">加入列表</button><button type="button" class="icon-btn" aria-label="取消新增">${icon('close')}</button></div>`;$('addList').hidden=true;$('board').append(form);form.querySelector('input').focus();form.scrollIntoView({behavior:motion()?'smooth':'instant',block:'nearest',inline:'end'});
  const cancel=()=>{form.remove();$('addList').hidden=false;};form.querySelector('[type=button]').onclick=cancel;form.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();cancel();}};
  form.onsubmit=e=>{e.preventDefault();const title=form.querySelector('input').value.trim();if(!title)return;state.lists.push({id:uid(),title,color:colors[state.lists.length%colors.length].color,cards:[]});save();renderBoard();$('board').scrollLeft=$('board').scrollWidth;toast('新的列表，新的開始');};
}
$('newCard').onclick=()=>{if(!state.lists.length){showListComposer();toast('先建立一個列表，就能加入卡片');return;}showComposer(state.lists[0].id);};
let menuListId=null;
function closeMenu(){$('listMenu').hidden=true;menuListId=null;}
function openMenu(id,button){const rect=button.getBoundingClientRect();menuListId=id;$('listMenu').innerHTML=`<button data-menu="rename">${icon('edit')}重新命名</button><button data-menu="left">${icon('arrow')}往左移動</button><button data-menu="right">${icon('arrow')}往右移動</button><button data-menu="delete" class="danger">${icon('trash')}刪除列表</button>`;$('listMenu').hidden=false;const m=$('listMenu');m.style.left=Math.max(10,Math.min(rect.right-180,innerWidth-200))+'px';m.style.top=Math.min(rect.bottom+5,innerHeight-m.offsetHeight-10)+'px';m.querySelector('button').focus();}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#listMenu,[data-list-menu]'))closeMenu();});
let actionHandler=null;
function ask({title,description,value,confirm='確認',danger=false},handler){actionHandler=handler;$('actionHeading').textContent=title;$('actionDescription').textContent=description;$('actionWarning').hidden=!danger;$('actionDialog').setAttribute('data-danger',String(danger));$('actionDialog').setAttribute('role',danger?'alertdialog':'dialog');$('actionInput').hidden=value===undefined;$('actionInput').required=value!==undefined;$('actionInput').value=value??'';$('actionConfirm').textContent=confirm;$('actionConfirm').className='btn '+(danger?'btn-danger':'btn-primary');openSmall('actionDialog');if(value!==undefined){$('actionInput').focus();$('actionInput').select();}else $('actionCancel').focus();}
function cancelAction(){actionHandler=null;$('actionDialog').close();}
$('actionCancel').onclick=cancelAction;$('actionDialog').addEventListener('cancel',e=>{e.preventDefault();cancelAction();});$('actionDialog').addEventListener('close',()=>{actionHandler=null;});
$('actionForm').onsubmit=e=>{e.preventDefault();if(!$('actionDialog').open)return;const value=$('actionInput').value.trim();if(!$('actionInput').hidden&&!value)return;const fn=actionHandler;actionHandler=null;$('actionDialog').close();return fn?.(value);};
$('listMenu').onclick=e=>{const b=e.target.closest('[data-menu]');if(!b)return;const id=menuListId,index=state.lists.findIndex(l=>l.id===id),list=state.lists[index];closeMenu();if(!list)return;
  if(b.dataset.menu==='rename')ask({title:'替列表換個名字',description:'好的名字，讓下一步更清晰。',value:list.title},value=>{list.title=value;save();renderBoard();});
  if(b.dataset.menu==='delete')requestDeleteList(id);
  if(b.dataset.menu==='left'||b.dataset.menu==='right'){const target=index+(b.dataset.menu==='left'?-1:1);if(target>=0&&target<state.lists.length){const old=measure();state.lists.splice(index,1);state.lists.splice(target,0,list);save();renderBoard();animateShift(old);}}
};
$('board').addEventListener('click',e=>{
  if(suppressClick){e.preventDefault();return;}
  const star=e.target.closest('[data-star]');if(star){const f=findCard(star.dataset.star);if(f){f.card.starred=!f.card.starred;save();patchCard(f.card.id);}return;}
  const menu=e.target.closest('[data-list-menu]');if(menu){openMenu(menu.dataset.listMenu,menu);return;}
  const add=e.target.closest('[data-add-card]');if(add){showComposer(add.dataset.addCard);return;}
  if(e.target.closest('#addList')){showListComposer();return;}
  const card=e.target.closest('.card');if(card)openCard(card.dataset.cardId,card);
});
$('board').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('card')){e.preventDefault();openCard(e.target.dataset.cardId,e.target);}});
