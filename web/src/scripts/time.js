// Persist deadlines, not ticking counters. Rendering never writes board data.
const timeTabIds={alarm:'timeTabAlarm',pomodoro:'timeTabPomodoro',timer:'timeTabTimer',stopwatch:'timeTabStopwatch'};
let timeTab='alarm',timeFrame=0,timeAudio=null,timeAlarmEditId=null,timeAudioNodes=[];
const timeNow=()=>Date.now();
const timeText=(id,value)=>{const text=String(value);if($(id).textContent!==text)$(id).textContent=text;};
const timerLeft=(now=timeNow())=>{const c=state.timeTools.timer;return c.deadline===null?c.remainingMs:Math.max(0,Math.min(c.durationMs,c.deadline-now));};
const pomLeft=(now=timeNow())=>{const p=state.timeTools.pomodoro;return p.deadline===null?p.remainingMs:Math.max(0,Math.min(p.phase==='focus'?p.focusMs:p.breakMs,p.deadline-now));};
const stopwatchElapsed=(now=timeNow())=>{const s=state.timeTools.stopwatch;return Math.min(TIME_STOP_MAX,Math.max(s.laps.at(-1)?.totalMs||0,s.elapsedMs+(s.startedAt===null?0:Math.max(0,now-s.startedAt))));};
function formatTime(ms,centiseconds=false){const units=centiseconds?Math.floor(Math.max(0,ms)/10):Math.ceil(Math.max(0,ms)/1000),seconds=centiseconds?Math.floor(units/100):units,hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60,sec=seconds%60;return (hours?String(hours).padStart(2,'0')+':':'')+String(minutes).padStart(2,'0')+':'+String(sec).padStart(2,'0')+(centiseconds?'.'+String(units%100).padStart(2,'0'):'');}
function localTimeInput(at){const d=new Date(at),pad=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
function alarmTimeLabel(at){return new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(at));}
function queueTimeAlert(kind,title,message,at){state.timeTools.alerts.push({id:uid(),kind,title,message,at});if(state.timeTools.alerts.length>20)state.timeTools.alerts.shift();}
function advanceTimeTools(now=timeNow()){
  const t=state.timeTools;let changed=false;
  for(const a of t.alarms)if(a.enabled&&a.at<=now){a.enabled=false;queueTimeAlert('alarm',a.label||'鬧鐘時間到',`設定時間：${alarmTimeLabel(a.at)}`,a.at);changed=true;}
  if(t.timer.deadline!==null&&t.timer.deadline<=now){const at=t.timer.deadline;t.timer.deadline=null;t.timer.remainingMs=0;queueTimeAlert('timer','倒數計時完成',`${formatTime(t.timer.durationMs)} 已到時間。`,at);changed=true;}
  const p=t.pomodoro;let transitions=0,lastAt=now,lastPhase=p.phase;
  while(p.deadline!==null&&p.deadline<=now){
    lastAt=p.deadline;lastPhase=p.phase;transitions++;changed=true;
    if(p.phase==='focus'&&p.round===p.rounds){p.completed=true;p.remainingMs=0;p.deadline=null;break;}
    if(p.phase==='focus')p.phase='break';else{p.phase='focus';p.round++;}
    p.remainingMs=p.phase==='focus'?p.focusMs:p.breakMs;p.deadline=p.autoContinue?lastAt+p.remainingMs:null;
  }
  if(transitions){const phase=p.phase==='focus'?'專注':'休息';queueTimeAlert('pomodoro',p.completed?'番茄鐘本輪完成':lastPhase==='focus'?'專注結束，休息一下':'休息結束，開始專注',p.completed?`已完成 ${p.rounds} 輪專注。`:transitions>1?`已補算 ${transitions} 個階段，現在是第 ${p.round} 輪${phase}。`:`第 ${p.round} 輪${phase}${p.autoContinue?'已自動開始':'等待按「繼續」'}。`,lastAt);}
  const s=t.stopwatch;if(s.startedAt!==null&&stopwatchElapsed(now)>=TIME_STOP_MAX){s.elapsedMs=TIME_STOP_MAX;s.startedAt=null;queueTimeAlert('stopwatch','碼表已暫停','已達 7 天計時上限。',now);changed=true;}
  return changed;
}
function timeCommit(now=timeNow(),syncSettings=false){const saved=save();renderTimeTools(true,now);if(syncSettings)syncTimeInputs();syncTimeFrame();return saved;}
function tickTimeTools(now=timeNow()){
  let changed=false;if(!conflict&&!loadProblem){changed=advanceTimeTools(now);if(changed){const saved=save();if(saved||(!conflict&&!loadProblem))ringTimeAlert();}}
  renderTimeTools(changed,now);syncTimeFrame();return changed;
}
function startTimer(durationMs,now=timeNow()){
  tickTimeTools(now);const c=state.timeTools.timer;if(c.deadline!==null)return false;
  const fresh=c.remainingMs===0||c.remainingMs===c.durationMs;
  if(durationMs!==undefined){if(!Number.isSafeInteger(durationMs)||durationMs<1000||durationMs>TIME_DAY||(!fresh&&durationMs!==c.durationMs))return false;if(fresh)c.durationMs=c.remainingMs=durationMs;}
  if(c.remainingMs<=0)c.remainingMs=c.durationMs;c.deadline=now+c.remainingMs;return timeCommit(now,true);
}
function pauseTimer(now=timeNow()){tickTimeTools(now);const c=state.timeTools.timer;if(c.deadline===null)return false;c.remainingMs=timerLeft(now);c.deadline=null;return timeCommit(now);}
function resetTimer(now=timeNow()){const c=state.timeTools.timer;c.deadline=null;c.remainingMs=c.durationMs;return timeCommit(now,true);}
const pomPristine=p=>p.deadline===null&&!p.completed&&p.phase==='focus'&&p.round===1&&p.remainingMs===p.focusMs;
function startPomodoro(config,now=timeNow()){
  tickTimeTools(now);const p=state.timeTools.pomodoro;if(p.deadline!==null)return false;
  if(config&&(pomPristine(p)||p.completed)){
    const {focusMinutes,breakMinutes,rounds,autoContinue}=config;
    if(!Number.isInteger(focusMinutes)||focusMinutes<1||focusMinutes>180||!Number.isInteger(breakMinutes)||breakMinutes<1||breakMinutes>60||!Number.isInteger(rounds)||rounds<1||rounds>12||typeof autoContinue!=='boolean')return false;
    Object.assign(p,{focusMs:focusMinutes*60000,breakMs:breakMinutes*60000,rounds,autoContinue,phase:'focus',round:1,remainingMs:focusMinutes*60000,completed:false});
  }
  if(p.completed){p.phase='focus';p.round=1;p.remainingMs=p.focusMs;p.completed=false;}
  if(p.remainingMs<=0)p.remainingMs=p.phase==='focus'?p.focusMs:p.breakMs;p.deadline=now+p.remainingMs;return timeCommit(now,true);
}
function pausePomodoro(now=timeNow()){tickTimeTools(now);const p=state.timeTools.pomodoro;if(p.deadline===null)return false;p.remainingMs=pomLeft(now);p.deadline=null;return timeCommit(now);}
function resetPomodoro(now=timeNow()){const p=state.timeTools.pomodoro;Object.assign(p,{phase:'focus',round:1,remainingMs:p.focusMs,deadline:null,completed:false});return timeCommit(now,true);}
function startStopwatch(now=timeNow()){tickTimeTools(now);const s=state.timeTools.stopwatch;if(s.startedAt!==null||s.elapsedMs>=TIME_STOP_MAX)return false;s.startedAt=now;return timeCommit(now);}
function pauseStopwatch(now=timeNow()){const s=state.timeTools.stopwatch;if(s.startedAt===null)return false;s.elapsedMs=stopwatchElapsed(now);s.startedAt=null;return timeCommit(now);}
function lapStopwatch(now=timeNow()){const s=state.timeTools.stopwatch;if(s.startedAt===null||s.laps.length>=100)return false;s.laps.push({id:uid(),totalMs:stopwatchElapsed(now)});return timeCommit(now);}
function resetStopwatch(now=timeNow()){state.timeTools.stopwatch={elapsedMs:0,startedAt:null,laps:[]};return timeCommit(now);}
function putAlarm(label,at,id=null,now=timeNow()){
  if(typeof label!=='string'||label.length>80||!Number.isSafeInteger(at)||at<=now||at>8640000000000000)return false;
  const t=state.timeTools,n=id?t.alarms.find(a=>a.id===id):null;if(id&&!n)return false;if(!id&&t.alarms.length>=50)return false;
  if(n)Object.assign(n,{label:label.trim()||'我的鬧鐘',at,enabled:true});else t.alarms.push({id:uid(),label:label.trim()||'我的鬧鐘',at,enabled:true});return timeCommit(now);
}
function toggleAlarm(id,now=timeNow()){const a=state.timeTools.alarms.find(a=>a.id===id);if(!a||(!a.enabled&&a.at<=now))return false;a.enabled=!a.enabled;return timeCommit(now);}
function removeAlarm(id){const a=state.timeTools.alarms.find(a=>a.id===id);if(!a)return;ask({title:'刪除這個鬧鐘？',description:`「${a.label}」的提醒設定將移除，完成後可復原。`,confirm:'刪除鬧鐘',danger:true},()=>{const list=state.timeTools.alarms,index=list.findIndex(a=>a.id===id);if(index<0)return;const removed=list.splice(index,1)[0];if(timeAlarmEditId===id)cancelAlarmEdit();timeCommit();toast('鬧鐘已刪除',()=>{if(state.timeTools.alarms.length>=50){toast('鬧鐘已達 50 個，請先留出空間');return;}if(state.timeTools.alarms.some(a=>a.id===id))return;removed.enabled=removed.enabled&&removed.at>timeNow();state.timeTools.alarms.splice(Math.min(index,state.timeTools.alarms.length),0,removed);timeCommit();});});}
function dismissTimeAlerts(id){state.timeTools.alerts=id?state.timeTools.alerts.filter(a=>a.id!==id):[];stopTimeSound();return timeCommit();}
function pauseImportedTimeTools(t,now=timeNow()){
  t.timer.deadline=null;t.timer.remainingMs=t.timer.durationMs;
  Object.assign(t.pomodoro,{phase:'focus',round:1,remainingMs:t.pomodoro.focusMs,deadline:null,completed:false});
  const s=t.stopwatch;s.elapsedMs=Math.min(TIME_STOP_MAX,Math.max(s.laps.at(-1)?.totalMs||0,s.elapsedMs+(s.startedAt===null?0:Math.max(0,now-s.startedAt))));s.startedAt=null;
  t.alarms.forEach(a=>{if(a.at<=now)a.enabled=false;});t.alerts=[];return t;
}
function stopTimeSound(){for(const node of timeAudioNodes){try{node.stop();}catch(e){}}timeAudioNodes=[];}
async function unlockTimeSound(){
  if(!state.timeTools.soundEnabled)return false;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){timeText('timeAudioStatus','目前環境沒有音效支援，仍會顯示視覺提醒。');return false;}timeAudio||=new Audio();if(timeAudio.state==='suspended')await timeAudio.resume();const ready=timeAudio.state==='running';timeText('timeAudioStatus',ready?'音效已就緒。提醒時會播放三聲提示音。':'音效尚未啟用，請按「試聽提醒音」。');return ready;}catch(e){timeText('timeAudioStatus','無法啟用音效，仍會顯示視覺提醒。');return false;}
}
function ringTimeAlert(){
  if(!state.timeTools.soundEnabled)return false;
  if(!timeAudio||timeAudio.state!=='running'){timeText('timeAudioStatus','音效尚未啟用，請按「試聽提醒音」；視覺提醒仍會顯示。');return false;}
  try{stopTimeSound();const start=timeAudio.currentTime;for(let i=0;i<3;i++){const oscillator=timeAudio.createOscillator(),gain=timeAudio.createGain(),at=start+i*.45;oscillator.type='sine';oscillator.frequency.value=i===1?784:659;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.28);oscillator.connect(gain);gain.connect(timeAudio.destination);oscillator.start(at);oscillator.stop(at+.3);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};timeAudioNodes.push(oscillator);}return true;}catch(e){timeText('timeAudioStatus','音效播放失敗，請使用視覺提醒。');return false;}
}
function syncTimeInputs(){
  const t=state.timeTools,c=t.timer,p=t.pomodoro;
  $('timerHours').value=String(Math.floor(c.durationMs/3600000));$('timerMinutes').value=String(Math.floor(c.durationMs/60000)%60);$('timerSeconds').value=String(Math.floor(c.durationMs/1000)%60);
  $('pomFocus').value=String(p.focusMs/60000);$('pomBreak').value=String(p.breakMs/60000);$('pomRounds').value=String(p.rounds);$('pomAuto').checked=p.autoContinue;$('timeSoundEnabled').checked=t.soundEnabled;timeText('timeAudioStatus',!t.soundEnabled?'提醒音已關閉，仍會顯示視覺提醒。':timeAudio?.state==='running'?'音效已就緒。提醒時會播放三聲提示音。':'請先試聽以啟用音效；未啟用時仍有視覺提醒。');
  if(!$('alarmAt').value)$('alarmAt').value=localTimeInput(timeNow()+300000);
}
function renderTimeTools(full=false,now=timeNow()){
  const t=state.timeTools,c=t.timer,p=t.pomodoro,s=t.stopwatch,last=t.alerts.at(-1),active=t.alarms.filter(a=>a.enabled).length+Number(c.deadline!==null)+Number(p.deadline!==null)+Number(s.startedAt!==null);
  timeText('timeCount',active);$('timeBanner').hidden=!last;if(last)timeText('timeBannerText',`${last.title} — ${last.message}${t.alerts.length>1?`（共 ${t.alerts.length} 則待確認）`:''}`);
  if($('timePage').hidden)return;
  // A dot on each tab shows which tools are running while another tab is open.
  const live={alarm:t.alarms.some(a=>a.enabled),pomodoro:p.deadline!==null,timer:c.deadline!==null,stopwatch:s.startedAt!==null};
  for(const [name,on] of Object.entries(live))$(timeTabIds[name]).classList.toggle('live',on);
  timeText('timeSaveStatus',storageOK&&!conflict&&!loadProblem?'已儲存在本機':'尚未儲存，請匯出備份');$('timeSavePill').classList.toggle('error',!storageOK||conflict||!!loadProblem);
  timeText('timerDisplay',formatTime(timerLeft(now)));timeText('timerStatus',c.deadline!==null?'倒數進行中':c.remainingMs===0?'時間到':c.remainingMs===c.durationMs?'設定好時間，就開始吧':'已暫停');timeText('timerStart',c.deadline!==null?'暫停':c.remainingMs>0&&c.remainingMs<c.durationMs?'繼續':'開始');
  const timerLocked=c.deadline!==null||(c.remainingMs>0&&c.remainingMs<c.durationMs);for(const id of ['timerHours','timerMinutes','timerSeconds'])$(id).disabled=timerLocked;
  timeText('pomDisplay',formatTime(pomLeft(now)));timeText('pomMode',p.completed?'本輪完成':p.phase==='focus'?'專注時間':'休息時間');timeText('pomStatus',p.completed?`已完成 ${p.rounds} 輪專注`:`第 ${p.round} / ${p.rounds} 輪 · ${p.deadline!==null?'進行中':pomPristine(p)?'準備開始':'已暫停，按繼續接續'}`);timeText('pomStart',p.deadline!==null?'暫停':p.completed?'再來一輪':pomPristine(p)?'開始專注':'繼續');
  for(const id of ['pomFocus','pomBreak','pomRounds','pomAuto'])$(id).disabled=!pomPristine(p)&&!p.completed;
  timeText('stopwatchDisplay',formatTime(stopwatchElapsed(now),true));timeText('stopwatchStatus',s.startedAt!==null?'計時中':s.elapsedMs>=TIME_STOP_MAX?'已達 7 天上限，請先重設':s.elapsedMs?'已暫停':'隨時開始，記錄每一段時間');$('stopwatchStart').disabled=s.startedAt===null&&s.elapsedMs>=TIME_STOP_MAX;timeText('stopwatchStart',s.startedAt!==null?'暫停':s.elapsedMs?'繼續':'開始');$('stopwatchLap').disabled=s.startedAt===null||s.laps.length>=100;
  if(!full)return;
  $('timeSoundEnabled').checked=t.soundEnabled;
  $('alarmList').innerHTML=t.alarms.length?t.alarms.map(a=>`<li class="time-alarm"><div><strong>${esc(a.label)}</strong><span>${esc(alarmTimeLabel(a.at))} · ${a.enabled?'啟用中':a.at<=now?'已到時間':'已停用'}</span></div><button class="time-small" data-alarm-toggle="${esc(a.id)}" aria-label="${a.enabled?'停用':'啟用'}鬧鐘：${esc(a.label)}" aria-pressed="${a.enabled}">${a.enabled?'停用':'啟用'}</button><button class="icon-btn" data-alarm-edit="${esc(a.id)}" aria-label="編輯鬧鐘：${esc(a.label)}">${icon('edit')}</button><button class="icon-btn danger" data-alarm-delete="${esc(a.id)}" aria-label="刪除鬧鐘：${esc(a.label)}">${icon('trash')}</button></li>`).join(''):'<li class="time-empty">還沒有鬧鐘，先為下一件事留個提醒。</li>';
  $('stopwatchLaps').innerHTML=s.laps.length?s.laps.map((lap,index)=>`<li><span>第 ${index+1} 次</span><span>分段 ${formatTime(lap.totalMs-(s.laps[index-1]?.totalMs||0),true)}</span><strong>${formatTime(lap.totalMs,true)}</strong></li>`).reverse().join(''):'<li class="time-empty">開始後按「計次」，記錄每一段時間。</li>';
  $('timeAlertList').innerHTML=t.alerts.length?[...t.alerts].reverse().map(a=>`<li class="time-alert"><div><strong>${esc(a.title)}</strong><p>${esc(a.message)}</p><small>${esc(alarmTimeLabel(a.at))}</small></div><button class="time-small" data-alert-dismiss="${esc(a.id)}">已讀</button></li>`).join(''):'<li class="time-empty">沒有待確認提醒。</li>';$('timeClearAlerts').disabled=!t.alerts.length;
}
function syncTimeFrame(){
  const needed=!$('timePage').hidden&&timeTab==='stopwatch'&&state.timeTools.stopwatch.startedAt!==null&&!document.hidden;
  if(!needed){cancelAnimationFrame(timeFrame);timeFrame=0;return;}
  if(!timeFrame)timeFrame=requestAnimationFrame(()=>{timeFrame=0;timeText('stopwatchDisplay',formatTime(stopwatchElapsed(timeNow()),true));syncTimeFrame();});
}
// Only the selected tool is displayed; the others keep running from their timestamps.
function setTimeTab(name,focus=false){
  if(!Object.hasOwn(timeTabIds,name))return;
  timeTab=name;selectTabs($('timeTabs'),tab=>tab.dataset.timeTab===name);
  document.querySelectorAll('[data-time-panel]').forEach(panel=>panel.hidden=panel.dataset.timePanel!==name);
  if(focus)$(timeTabIds[name]).focus({preventScroll:true});
  renderTimeTools(false);syncTimeFrame();
}
function setTimeOpen(open){
  if(noteDrag)finishNoteDrag(true);$('timePage').hidden=!open;$('notesPanel').hidden=true;$('kanbanPage').hidden=open;
  syncNotesNavigation(false);
  $('openTime').classList.toggle('active',open);$('openTime').setAttribute('aria-current',open?'page':'false');$('workspaceSearch').hidden=open;$('workspaceShortcuts').hidden=open;
  $('workspaceCrumb').textContent=open?'時間工具箱':'我的看板';document.title=open?'時間工具箱 · 拾序 Studio':(state.title||'我的看板')+' · 拾序 Studio';
  if(!open){$('workspaceShortcuts').innerHTML='<i>N</i> 新增卡片&nbsp;&nbsp; <i>Ctrl K</i> 搜尋&nbsp;&nbsp; <i>Esc</i> 關閉視窗';$('search').value=query;$('search').placeholder='搜尋卡片…';$('search').setAttribute('aria-label','搜尋卡片');}
  closeMobile();closeMenu();renderStats();tickTimeTools();if(open){syncTimeInputs();renderTimeTools(true);$(timeTabIds[timeTab]).focus({preventScroll:true});}else $('newCard').focus({preventScroll:true});syncTimeFrame();
}
function cancelAlarmEdit(){timeAlarmEditId=null;$('alarmLabel').value='';$('alarmAt').value=localTimeInput(timeNow()+300000);timeText('alarmSubmit','新增鬧鐘');$('alarmCancelEdit').hidden=true;}
function startTimerFromUI(){
  const c=state.timeTools.timer;if(c.deadline!==null){pauseTimer();return;}
  const values=['timerHours','timerMinutes','timerSeconds'].map(id=>Number($(id).value||0));if(values.some(v=>!Number.isInteger(v)||v<0)||values[0]>24||values[1]>59||values[2]>59){toast('請輸入有效的時、分、秒');return;}
  const duration=(values[0]*3600+values[1]*60+values[2])*1000;if(duration<1000||duration>TIME_DAY){toast('倒數時間需介於 1 秒與 24 小時之間');return;}void unlockTimeSound();startTimer(duration);
}
function startPomodoroFromUI(){if(state.timeTools.pomodoro.deadline!==null){pausePomodoro();return;}void unlockTimeSound();if(!startPomodoro({focusMinutes:Number($('pomFocus').value),breakMinutes:Number($('pomBreak').value),rounds:Number($('pomRounds').value),autoContinue:$('pomAuto').checked}))toast('請確認專注 1～180 分鐘、休息 1～60 分鐘與 1～12 輪的設定');}
$('openTime').onclick=()=>setTimeOpen(true);$('closeTime').onclick=()=>setTimeOpen(false);
$('alarmForm').onsubmit=e=>{e.preventDefault();const at=new Date($('alarmAt').value).getTime();if(putAlarm($('alarmLabel').value,at,timeAlarmEditId)){cancelAlarmEdit();void unlockTimeSound();}else toast('請設定未來的日期時間；最多可保留 50 個鬧鐘。');};$('alarmCancelEdit').onclick=cancelAlarmEdit;
$('alarmList').onclick=e=>{const edit=e.target.closest('[data-alarm-edit]'),toggle=e.target.closest('[data-alarm-toggle]'),remove=e.target.closest('[data-alarm-delete]');if(edit){const a=state.timeTools.alarms.find(a=>a.id===edit.dataset.alarmEdit);if(!a)return;timeAlarmEditId=a.id;$('alarmLabel').value=a.label;$('alarmAt').value=localTimeInput(a.at);timeText('alarmSubmit','儲存變更');$('alarmCancelEdit').hidden=false;$('alarmLabel').focus();}else if(toggle){if(!toggleAlarm(toggle.dataset.alarmToggle))toast('這個鬧鐘時間已過，請先編輯為未來時間。');else void unlockTimeSound();}else if(remove)removeAlarm(remove.dataset.alarmDelete);};
$('timerForm').onsubmit=e=>{e.preventDefault();startTimerFromUI();};$('timerStart').onclick=startTimerFromUI;
$('timerForm').onchange=()=>{const c=state.timeTools.timer;if(c.deadline!==null||(c.remainingMs>0&&c.remainingMs<c.durationMs))return;const [h,m,s]=['timerHours','timerMinutes','timerSeconds'].map(id=>Number($(id).value||0)),duration=(h*3600+m*60+s)*1000;if(![h,m,s].every(v=>Number.isInteger(v)&&v>=0)||h>24||m>59||s>59||duration<1000||duration>TIME_DAY||duration===c.durationMs)return;c.durationMs=c.remainingMs=duration;timeCommit();};
$('timerReset').onclick=()=>{const c=state.timeTools.timer;if(c.deadline!==null||(c.remainingMs>0&&c.remainingMs<c.durationMs))ask({title:'重設倒數計時？',description:'目前倒數進度將清除，回到設定的完整時間。此重設無法復原。',confirm:'重設',danger:true},()=>resetTimer());else resetTimer();};
$('pomForm').onsubmit=e=>{e.preventDefault();startPomodoroFromUI();};$('pomStart').onclick=startPomodoroFromUI;
$('pomForm').onchange=()=>{const p=state.timeTools.pomodoro;if(!pomPristine(p)&&!p.completed)return;const focus=Number($('pomFocus').value),rest=Number($('pomBreak').value),rounds=Number($('pomRounds').value),auto=$('pomAuto').checked;if(!Number.isInteger(focus)||focus<1||focus>180||!Number.isInteger(rest)||rest<1||rest>60||!Number.isInteger(rounds)||rounds<1||rounds>12)return;if(p.focusMs===focus*60000&&p.breakMs===rest*60000&&p.rounds===rounds&&p.autoContinue===auto&&!p.completed)return;Object.assign(p,{focusMs:focus*60000,breakMs:rest*60000,rounds,autoContinue:auto,phase:'focus',round:1,remainingMs:focus*60000,deadline:null,completed:false});timeCommit();};
$('pomReset').onclick=()=>{if(!pomPristine(state.timeTools.pomodoro))ask({title:'重設番茄鐘？',description:'目前的輪數與進度將清除，回到第一輪專注。此重設無法復原。',confirm:'重設',danger:true},()=>resetPomodoro());else resetPomodoro();};
$('stopwatchStart').onclick=()=>state.timeTools.stopwatch.startedAt===null?startStopwatch():pauseStopwatch();$('stopwatchLap').onclick=()=>lapStopwatch();$('stopwatchReset').onclick=()=>{if(stopwatchElapsed()>0||state.timeTools.stopwatch.laps.length)ask({title:'重設碼表？',description:'累計時間與全部計次將清除，此動作無法復原。',confirm:'重設',danger:true},()=>resetStopwatch());else resetStopwatch();};
$('timeSoundEnabled').onchange=e=>{state.timeTools.soundEnabled=e.target.checked;timeCommit();if(e.target.checked)void unlockTimeSound();else{stopTimeSound();timeText('timeAudioStatus','提醒音已關閉，仍會顯示視覺提醒。');}};
$('timeTestSound').onclick=async()=>{if(!state.timeTools.soundEnabled){toast('請先勾選提醒音，再試聽。');return;}if(await unlockTimeSound())ringTimeAlert();};
$('timeClearAlerts').onclick=()=>dismissTimeAlerts();$('timeBannerDismiss').onclick=()=>dismissTimeAlerts();$('timeBannerView').onclick=()=>{const kind=state.timeTools.alerts.at(-1)?.kind;setTimeOpen(true);if(kind)setTimeTab(kind);$('timeReminders').scrollIntoView({block:'nearest'});};
document.querySelectorAll('[data-time-tab]').forEach(tab=>tab.onclick=()=>setTimeTab(tab.dataset.timeTab));bindTabKeys($('timeTabs'));$('timeAlertList').onclick=e=>{const b=e.target.closest('[data-alert-dismiss]');if(b)dismissTimeAlerts(b.dataset.alertDismiss);};
document.addEventListener('visibilitychange',()=>{tickTimeTools();syncTimeFrame();});window.addEventListener('focus',()=>tickTimeTools());
function initializeTimeTools(){tickTimeTools();const check=()=>{tickTimeTools();setTimeout(check,500);};setTimeout(check,500);}

