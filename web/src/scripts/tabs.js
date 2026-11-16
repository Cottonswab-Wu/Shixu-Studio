// Shared tab lists (board views, time tools). Only the selected tab is in the
// Tab order; arrow keys, Home and End move between tabs and activate them.
function selectTabs(list,isSelected){
  for(const tab of list.querySelectorAll('[role="tab"]')){
    const on=isSelected(tab);
    tab.classList.toggle('active',on);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;
  }
}
function bindTabKeys(list){
  list.addEventListener('keydown',e=>{
    const tabs=[...list.querySelectorAll('[role="tab"]')],index=tabs.indexOf(e.target);
    if(index<0||e.altKey||e.ctrlKey||e.metaKey)return;
    const next={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:tabs.length-1}[e.key];
    if(next===undefined)return;
    e.preventDefault();const tab=tabs[(next+tabs.length)%tabs.length];tab.focus();tab.click();
  });
}
