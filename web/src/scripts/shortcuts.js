document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(todoDrag){e.preventDefault();finishTodoDrag(true);return;}if(noteDrag){e.preventDefault();finishNoteDrag(true);return;}if(drag){e.preventDefault();finishDrag(true);return;}closeMenu();closeMobile();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')&&$('timePage').hidden){e.preventDefault();$('search').focus();$('search').select();}
  if(e.key.toLowerCase()==='n'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.isComposing&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!document.querySelector('dialog[open]')&&$('timePage').hidden){e.preventDefault();if($('notesPanel').hidden)$('newCard').click();else openNoteEditor();}
});
