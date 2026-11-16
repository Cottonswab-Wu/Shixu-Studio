initializeAppearance();
$('today').textContent=new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'short'}).format(new Date());
$('boardTitle').value=state.title;document.title=(state.title||'我的看板')+' · 拾序 Studio';renderFilters();renderBoard();
if(loadProblem){notice(loadProblem,storageOK?'啟用儲存':'');setStatus(false);}else if(lastSaved===null){save();}else{setStatus(true);}
initializeTimeTools();renderClock();
