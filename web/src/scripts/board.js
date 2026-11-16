function labelById(id){return {...colors.find(x=>x.id===id),name:state.labels.find(x=>x.id===id)?.name||'未命名'};}
function findCard(id){for(const list of state.lists){const card=list.cards.find(x=>x.id===id);if(card)return {list,card};}return null;}
function tagsHTML(card){return card.labels.map(id=>{const l=labelById(id);return `<span class="tag" style="--tint:${l.tint};--tone:${l.tone}">${esc(l.name||'未命名')}</span>`;}).join('');}
function matches(card,dates){if(view==='starred'&&!card.starred)return false;if(view==='week'&&(!card.due||card.due<(dates?.today||dateISO())||card.due>(dates?.week||dateISO(6))))return false;if(labelFilter&&!card.labels.includes(labelFilter))return false;return !query||[card.title,card.desc,...card.todos.map(t=>t.title),...card.labels.map(id=>labelById(id).name)].join(' ').toLocaleLowerCase().includes(query);}
function cardHTML(card,dates){
  const done=card.todos.filter(t=>t.done).length, total=card.todos.length;
  const dueClass=card.due&&card.due<(dates?.today||dateISO())?'overdue':card.due&&card.due<=(dates?.soon||dateISO(2))?'soon':'';
  // The board shows two lines; the editor, search and backups keep the full text.
  const preview=card.desc.slice(0,300);
  return `<article class="card" data-card-id="${esc(card.id)}" tabindex="0" role="button" aria-label="開啟卡片：${esc(card.title||'未命名卡片')}">
  ${card.cover?`<div class="card-cover cover-${card.cover}" aria-hidden="true"><div class="orb"></div></div>`:''}
  ${card.labels.length?`<div class="card-labels">${tagsHTML(card)}</div>`:''}<div class="card-title">${esc(card.title||'未命名卡片')}</div>${card.desc?`<p class="card-desc">${esc(preview)}</p>`:''}
  <button class="card-favorite ${card.starred?'on':''}" data-star="${esc(card.id)}" aria-pressed="${card.starred}" aria-label="${card.starred?'取消收藏':'收藏卡片'}">${icon('star')}</button>
  ${total?`<div class="mini-progress" aria-hidden="true"><i style="width:${Math.round(done/total*100)}%;${done===total?'background:#a4c0ad':''}"></i></div>`:''}
  <div class="card-footer"><div class="card-meta">${card.due?`<span class="due ${dueClass}" title="${esc(card.due)}">${icon('calendar')}${Number(card.due.slice(5,7))} 月 ${Number(card.due.slice(8))} 日</span>`:''}${total?`<span class="task-count ${done===total?'complete':''}" title="已完成 ${done} 個，共 ${total} 個子任務">${icon('checklist')}${done}/${total}</span>`:''}${card.desc?`<span title="含描述">${icon('text')}</span>`:''}</div><span class="card-initial" aria-hidden="true">我</span></div></article>`;
}
// Tab counts: total, starred, and cards due from today through the next six days.
function countCard(stats,card,dates){stats.total++;if(card.starred)stats.starred++;if(card.due&&card.due>=dates.today&&card.due<=dates.week)stats.week++;}
function renderStats(stats){
  if(!stats){stats={total:0,shown:0,starred:0,week:0};const dates={today:dateISO(),week:dateISO(6)};for(const list of state.lists)for(const card of list.cards){countCard(stats,card,dates);if(matches(card,dates))stats.shown++;}}
  const {total,shown,starred,week}=stats,onBoard=$('notesPanel').hidden&&$('timePage').hidden;
  $('allCount').textContent=total;$('tabAllCount').textContent=total;$('starCount').textContent=starred;$('weekCount').textContent=week;
  const filtered=view!=='all'||!!query||!!labelFilter;
  $('boardSummary').innerHTML=filtered?`<b>${shown}</b> 張符合的卡片 <span style="margin:0 7px">/</span> 共 ${total} 張`:`<b>${state.lists.length}</b> 個列表 <span style="margin:0 7px">·</span> <b>${total}</b> 張卡片 <span style="margin:0 7px">·</span> 每個小步驟，都算數。`;
  $('clearFilters').hidden=!filtered;
  selectTabs($('viewTabs'),tab=>tab.dataset.view===view);
  $('openBoard').classList.toggle('active',onBoard);$('openBoard').setAttribute('aria-current',onBoard?'page':'false');
}
function renderFilters(){$('colorFilters').innerHTML=colors.map(c=>{const l=labelById(c.id);return `<button class="color-dot ${labelFilter===c.id?'selected':''}" style="--label:${c.color}" data-filter="${c.id}" aria-label="篩選標籤：${esc(l.name)}" aria-pressed="${labelFilter===c.id}" title="${esc(l.name)}"></button>`;}).join('');}
function renderBoard(){
  const board=$('board'), scroll=board.scrollLeft, positions=new Map([...board.querySelectorAll('.list')].map(l=>[l.dataset.listId,l.querySelector('.cards').scrollTop]));
  const stats={total:0,shown:0,starred:0,week:0},dates={today:dateISO(),week:dateISO(6),soon:dateISO(2)};
  closeMenu();
  board.innerHTML=state.lists.map(l=>{const visible=l.cards.filter(card=>{countCard(stats,card,dates);if(!matches(card,dates))return false;stats.shown++;return true;});return `<section class="list" data-list-id="${esc(l.id)}" aria-label="${esc(l.title||'未命名列表')}" style="--list-color:${l.color}"><header class="list-header"><span class="list-dot"></span><h2 class="list-title">${esc(l.title||'未命名列表')}</h2><span class="list-count">${visible.length}</span><button class="icon-btn" data-list-menu="${esc(l.id)}" aria-label="${esc(l.title)}的列表選單">${icon('more')}</button></header><div class="cards">${visible.map(card=>cardHTML(card,dates)).join('')}${!visible.length?'<div class="list-empty">'+(l.cards.length?'沒有符合條件的卡片':'留個位置，給下一個好想法。')+'</div>':''}</div><button class="add-card" data-add-card="${esc(l.id)}">${icon('plus')}新增卡片</button></section>`;}).join('')+(!state.lists.length?`<div class="no-lists">${icon('board')}<strong>從一個小小的列表開始</strong>新增列表，替下一個計畫留個位置。</div>`:'')+`<button class="add-list" id="addList">${icon('plus')}新增一個列表</button>`;
  board.scrollLeft=scroll;board.querySelectorAll('.list').forEach(l=>l.querySelector('.cards').scrollTop=positions.get(l.dataset.listId)||0);
  renderStats(stats);
  renderNotes();renderTimeTools(true);if(!$('timePage').hidden)syncTimeInputs();
}
function patchCard(id){const found=findCard(id);const el=document.querySelector(`.card[data-card-id="${CSS.escape(id)}"]`);if(el&&found&&matches(found.card)){el.outerHTML=cardHTML(found.card);renderStats();}else renderBoard();}
