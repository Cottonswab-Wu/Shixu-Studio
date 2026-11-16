// Sidebar clock in the computer's local time. One text update per second while
// the page is visible; it also refreshes the top-bar date after midnight.
const clockHM=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockDay=new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
const clockTopDate=new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'short'});
let clockTimer=0,clockDayKey='';
function renderClock(){
  clearTimeout(clockTimer);if(document.hidden)return;
  const now=new Date(),day=now.toDateString();
  timeText('clockHM',clockHM.format(now));timeText('clockSeconds',':'+String(now.getSeconds()).padStart(2,'0'));
  if(day!==clockDayKey){clockDayKey=day;$('clockDate').textContent=clockDay.format(now);$('today').textContent=clockTopDate.format(now);}
  clockTimer=setTimeout(renderClock,1000-now.getMilliseconds()+5);
}
document.addEventListener('visibilitychange',renderClock);
