'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {boot}=require('../../web/verify.cjs');
const KEY='shixu.studio.board.v1',DAY=86400000,NOW=Date.UTC(2030,0,1);
const plain=value=>JSON.parse(JSON.stringify(value));
for(const target of ['web','desktop']){
  const scriptSource=target==='web'?fs.readFileSync(path.resolve(__dirname,'../../web/index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]:fs.readFileSync(path.resolve(__dirname,'../app/renderer.js'),'utf8');
  const make=(options={})=>boot({now:NOW,scriptSource,...options});
  const check=(name,run)=>test(`${target}: ${name}`,run);
  check('Older boards get idle tools without a startup rewrite',()=>{
    const seed=make(),legacy=plain(seed.app.state);delete legacy.timeTools;const raw=JSON.stringify(legacy),h=make({store:new Map([[KEY,raw]])});
    assert.equal(h.store.get(KEY),raw);assert.equal(h.operations.writes.length,0);assert.equal(h.app.state.timeTools.timer.deadline,null);assert.equal(h.app.state.timeTools.pomodoro.focusMs,1500000);
  });
  check('Countdown compensates elapsed wall time and does not write on ticks',()=>{
    const h=make();assert(h.app.startTimer(10000,NOW));const writes=h.operations.writes.length;
    h.clock.now+=7654;assert.equal(h.app.timerLeft(),2346);h.app.tickTimeTools();assert.equal(h.operations.writes.length,writes);
    h.clock.now+=3000;assert(h.app.tickTimeTools());assert.equal(h.app.timerLeft(),0);assert.equal(h.app.state.timeTools.alerts.length,1);assert.equal(h.get('timeBanner').hidden,false);
    const done=h.operations.writes.length;h.app.tickTimeTools();assert.equal(h.operations.writes.length,done);assert.equal(h.app.state.timeTools.alerts.length,1);
  });
  check('Countdown pause, resume and reload retain exact remaining time',()=>{
    const h=make();h.app.startTimer(10000,NOW);h.clock.now+=3500;h.app.pauseTimer();assert.equal(h.app.timerLeft(),6500);
    h.clock.now+=60000;assert.equal(h.app.timerLeft(),6500);h.app.startTimer(undefined,h.clock.now);
    const reopened=make({store:h.store,now:h.clock.now+1200});assert.equal(reopened.app.timerLeft(),5300);assert.equal(reopened.operations.writes.length,0);
    assert.doesNotThrow(()=>reopened.app.validate(JSON.parse(h.store.get(KEY))));
  });
  check('Overdue countdown fires once on reopen and acknowledgement persists',()=>{
    const h=make();h.app.startTimer(1000,NOW);const reopened=make({store:h.store,now:NOW+5000});assert.equal(reopened.app.state.timeTools.alerts.length,1);assert.equal(reopened.app.state.timeTools.timer.deadline,null);
    const again=make({store:h.store,now:NOW+6000});assert.equal(again.app.state.timeTools.alerts.length,1);again.app.dismissTimeAlerts();const final=make({store:h.store,now:NOW+7000});assert.equal(final.app.state.timeTools.alerts.length,0);
  });
  check('Countdown rejects invalid ranges and preserves a paused duration',()=>{
    const h=make();for(const duration of [0,-1,1.5,DAY+1,NaN])assert.equal(h.app.startTimer(duration,NOW),false);
    h.app.startTimer(10000,NOW);h.clock.now+=1000;h.app.pauseTimer();assert.equal(h.app.startTimer(20000,h.clock.now),false);assert.equal(h.app.timerLeft(),9000);h.app.resetTimer();assert.equal(h.app.timerLeft(),10000);
  });
  check('Alarms trigger once, support future edits and cannot enable a past time',()=>{
    const h=make();assert.equal(h.app.putAlarm('錯誤',NOW,null,NOW),false);assert(h.app.putAlarm('喝水',NOW+1000,null,NOW));const a=h.app.state.timeTools.alarms[0];
    h.clock.now+=2000;h.app.tickTimeTools();assert.equal(a.enabled,false);assert.equal(h.app.state.timeTools.alerts[0].title,'喝水');assert.equal(h.app.toggleAlarm(a.id),false);
    assert(h.app.putAlarm('新的提醒',NOW+10000,a.id,h.clock.now));assert.equal(a.enabled,true);assert.equal(h.app.state.timeTools.alarms.length,1);
    const reopened=make({store:h.store,now:NOW+3000});assert.equal(reopened.app.state.timeTools.alerts.length,1);
  });
  check('Alarm deletion confirms, cancels and restores its settings',()=>{
    const h=make();h.app.putAlarm('提醒',NOW+10000,null,NOW);const a=plain(h.app.state.timeTools.alarms[0]);h.app.removeAlarm(a.id);assert(h.get('actionDialog').open);h.get('actionCancel').onclick();assert.equal(h.app.state.timeTools.alarms.length,1);
    h.app.removeAlarm(a.id);h.get('actionForm').onsubmit({preventDefault(){}});assert.equal(h.app.state.timeTools.alarms.length,0);h.get('toastUndo').onclick();assert.deepEqual(plain(h.app.state.timeTools.alarms),[a]);
  });
  check('Pomodoro advances work/break rounds and completes without repeated alerts',()=>{
    const h=make();assert(h.app.startPomodoro({focusMinutes:1,breakMinutes:1,rounds:2,autoContinue:true},NOW));
    h.clock.now+=60000;h.app.tickTimeTools();let p=h.app.state.timeTools.pomodoro;assert.equal(p.phase,'break');assert.equal(p.round,1);assert.equal(p.deadline,NOW+120000);
    h.clock.now+=60000;h.app.tickTimeTools();assert.equal(p.phase,'focus');assert.equal(p.round,2);
    h.clock.now+=60000;h.app.tickTimeTools();assert.equal(p.completed,true);assert.equal(p.deadline,null);const count=h.app.state.timeTools.alerts.length;h.app.tickTimeTools();assert.equal(h.app.state.timeTools.alerts.length,count);
  });
  check('A delayed Pomodoro tick catches up all elapsed phases, using original deadlines',()=>{
    const h=make();h.app.startPomodoro({focusMinutes:1,breakMinutes:1,rounds:4,autoContinue:true},NOW);h.clock.now+=305000;h.app.tickTimeTools();const p=h.app.state.timeTools.pomodoro;
    assert.equal(p.phase,'break');assert.equal(p.round,3);assert.equal(p.deadline,NOW+360000);assert.equal(h.app.pomLeft(),55000);assert.equal(h.app.state.timeTools.alerts.length,1);assert(h.app.state.timeTools.alerts[0].message.includes('5 個階段'));
  });
  check('Manual Pomodoro progression waits, and pause/resume loses no time',()=>{
    const h=make();h.app.startPomodoro({focusMinutes:1,breakMinutes:1,rounds:2,autoContinue:false},NOW);h.clock.now+=3600000;h.app.tickTimeTools();const p=h.app.state.timeTools.pomodoro;assert.equal(p.phase,'break');assert.equal(p.round,1);assert.equal(p.deadline,null);assert.equal(h.app.pomLeft(),60000);
    h.app.startPomodoro(undefined,h.clock.now);h.clock.now+=1234;h.app.pausePomodoro();assert.equal(p.remainingMs,58766);h.clock.now+=5000;h.app.startPomodoro(undefined,h.clock.now);assert.equal(p.deadline,h.clock.now+58766);
  });
  check('Pomodoro restart and reset preserve configuration and reject invalid settings',()=>{
    const h=make();assert.equal(h.app.startPomodoro({focusMinutes:0,breakMinutes:1,rounds:1,autoContinue:true},NOW),false);
    h.app.startPomodoro({focusMinutes:1,breakMinutes:1,rounds:1,autoContinue:true},NOW);h.clock.now+=60000;h.app.tickTimeTools();assert(h.app.state.timeTools.pomodoro.completed);h.app.startPomodoro(undefined,h.clock.now);assert.equal(h.app.pomLeft(),60000);h.app.resetPomodoro();assert.equal(h.app.state.timeTools.pomodoro.deadline,null);assert.equal(h.app.state.timeTools.pomodoro.focusMs,60000);
  });
  check('Stopwatch supports pause, resume and lap totals with exact elapsed milliseconds',()=>{
    const h=make();assert.equal(h.app.lapStopwatch(NOW),false);h.app.startStopwatch(NOW);h.clock.now+=1234;h.app.lapStopwatch();h.clock.now+=500;h.app.lapStopwatch();h.app.pauseStopwatch();assert.equal(h.app.stopwatchElapsed(),1734);assert.deepEqual(plain(h.app.state.timeTools.stopwatch.laps.map(l=>l.totalMs)),[1234,1734]);
    h.clock.now+=10000;assert.equal(h.app.stopwatchElapsed(),1734);h.app.startStopwatch();h.clock.now+=1000;assert.equal(h.app.stopwatchElapsed(),2734);
    const reopened=make({store:h.store,now:h.clock.now});assert.equal(reopened.app.stopwatchElapsed(),2734);assert.equal(reopened.app.state.timeTools.stopwatch.laps.length,2);h.app.resetStopwatch();assert.equal(h.app.stopwatchElapsed(),0);
  });
  check('Stopwatch display refreshes without saving and caps laps/elapsed duration',()=>{
    const h=make();h.app.startStopwatch(NOW);const writes=h.operations.writes.length;for(let i=0;i<20;i++)h.app.renderTimeTools(false,NOW+i*10);assert.equal(h.operations.writes.length,writes);
    for(let i=0;i<100;i++)h.app.lapStopwatch(NOW+i);assert.equal(h.app.lapStopwatch(NOW+101),false);
    h.clock.now+=604800001;h.app.tickTimeTools();assert.equal(h.app.state.timeTools.stopwatch.startedAt,null);assert.equal(h.app.stopwatchElapsed(),604800000);
  });
  check('Multiple due tools produce bounded pending reminders and global visual alerts',()=>{
    const h=make();for(let i=0;i<25;i++)h.app.putAlarm('提醒 '+i,NOW+1000,null,NOW);h.clock.now+=1000;h.app.tickTimeTools();assert.equal(h.app.state.timeTools.alerts.length,20);assert.equal(h.get('timeBanner').hidden,false);assert(h.get('timeBannerText').textContent.includes('20 則'));
  });
  check('Tool pages switch without pausing or destroying the board and notes',()=>{
    const h=make(),lists=plain(h.app.state.lists);h.app.startTimer(10000,NOW);h.app.setTimeOpen(true);assert.equal(h.get('kanbanPage').hidden,true);assert.equal(h.get('notesPanel').hidden,true);assert.equal(h.get('timePage').hidden,false);
    h.app.setNotesOpen(true);assert.equal(h.get('timePage').hidden,true);assert.equal(h.get('notesPanel').hidden,false);h.app.setNotesOpen(false);assert.equal(h.get('kanbanPage').hidden,false);assert.equal(h.app.state.timeTools.timer.deadline,NOW+10000);assert.deepEqual(plain(h.app.state.lists),lists);
  });
  check('Idle timer and Pomodoro settings persist on change without starting a clock',()=>{
    const h=make();h.app.setTimeOpen(true);h.get('timerHours').value='0';h.get('timerMinutes').value='3';h.get('timerSeconds').value='15';h.get('timerForm').onchange();
    h.get('pomFocus').value='30';h.get('pomBreak').value='6';h.get('pomRounds').value='3';h.get('pomAuto').checked=false;h.get('pomForm').onchange();
    const reopened=make({store:h.store});assert.equal(reopened.app.state.timeTools.timer.durationMs,195000);assert.equal(reopened.app.state.timeTools.timer.deadline,null);assert.equal(reopened.app.state.timeTools.pomodoro.focusMs,1800000);assert.equal(reopened.app.state.timeTools.pomodoro.breakMs,360000);assert.equal(reopened.app.state.timeTools.pomodoro.rounds,3);assert.equal(reopened.app.state.timeTools.pomodoro.autoContinue,false);assert.equal(reopened.app.state.timeTools.pomodoro.deadline,null);
  });
  check('Malformed tool backup data and duplicate IDs are rejected',()=>{
    const h=make();h.app.putAlarm('測試',NOW+1000,null,NOW);const valid=plain(h.app.state);
    for(const change of [s=>s.timeTools.version=99,s=>s.timeTools.soundEnabled='true',s=>s.timeTools.alarms[0].id=s.lists[0].id,s=>s.timeTools.alarms[0].at=NaN,s=>s.timeTools.timer.durationMs=0,s=>s.timeTools.timer.remainingMs=-1,s=>s.timeTools.timer.deadline='future',s=>s.timeTools.pomodoro.rounds=0,s=>s.timeTools.pomodoro.phase='evil',s=>s.timeTools.pomodoro.completed=true,s=>s.timeTools.stopwatch.elapsedMs=-1,s=>s.timeTools.stopwatch.laps=[{id:'lap',totalMs:1}]]){const bad=plain(valid);change(bad);assert.throws(()=>h.app.validate(bad));}
    valid.timeTools.untrusted='ignore';assert.equal(h.app.validate(valid).timeTools.untrusted,undefined);
  });
  check('Import normalization resets active countdowns and pauses stopwatch without surprise alarms',()=>{
    const h=make();h.app.startTimer(10000,NOW);h.app.startPomodoro({focusMinutes:1,breakMinutes:1,rounds:2,autoContinue:true},NOW);h.app.startStopwatch(NOW);h.app.putAlarm('即將提醒',NOW+1000,null,NOW);
    const t=plain(h.app.state.timeTools);h.app.pauseImportedTimeTools(t,NOW+5000);assert.equal(t.timer.deadline,null);assert.equal(t.timer.remainingMs,10000);assert.equal(t.pomodoro.deadline,null);assert.equal(t.stopwatch.startedAt,null);assert.equal(t.stopwatch.elapsedMs,5000);assert.equal(t.alarms[0].enabled,false);assert.equal(t.alerts.length,0);
  });
  check('JSON import and undo restore tool settings through the real confirmation handler',async()=>{
    const h=make();h.app.startTimer(3000,NOW);const before=plain(h.app.state.timeTools);
    const source=make();source.app.startTimer(20000,NOW);source.app.startPomodoro({focusMinutes:2,breakMinutes:1,rounds:3,autoContinue:false},NOW);source.app.startStopwatch(NOW);source.app.putAlarm('匯入提醒',NOW+2000,null,NOW);const backup=plain(source.app.state);
    h.clock.now=NOW+4000;await h.get('importFile').onchange({target:{files:[{size:500,text:async()=>JSON.stringify({board:backup})}],value:'x'}});
    assert(h.get('actionDescription').textContent.includes('重設倒數及番茄鐘'));h.get('actionForm').onsubmit({preventDefault(){}});
    const restored=h.app.state.timeTools;assert.equal(restored.timer.durationMs,20000);assert.equal(restored.timer.deadline,null);assert.equal(restored.pomodoro.focusMs,120000);assert.equal(restored.pomodoro.deadline,null);assert.equal(restored.stopwatch.startedAt,null);assert.equal(restored.stopwatch.elapsedMs,4000);assert.equal(restored.alarms[0].enabled,false);
    h.get('toastUndo').onclick();assert.deepEqual(plain(h.app.state.timeTools),before);
  });
  check('Storage failure and conflict never overwrite previously saved tools',()=>{
    const h=make(),before=h.store.get(KEY);h.flags.quota=true;assert.equal(h.app.startTimer(10000,NOW),false);assert.equal(h.store.get(KEY),before);assert.equal(h.get('timeSaveStatus').textContent,'尚未儲存，請匯出備份');
    h.flags.quota=false;h.app.save();const external=JSON.parse(h.store.get(KEY));external.title='另一個視窗';h.store.set(KEY,JSON.stringify(external));h.clock.now+=20000;h.app.tickTimeTools();assert(h.app.conflict);assert.equal(JSON.parse(h.store.get(KEY)).title,'另一個視窗');
  });
  check('Formatting uses ceil for countdown seconds and floor for stopwatch centiseconds',()=>{
    const h=make();assert.equal(h.app.formatTime(1),'00:01');assert.equal(h.app.formatTime(0),'00:00');assert.equal(h.app.formatTime(3600000),'01:00:00');assert.equal(h.app.formatTime(1234,true),'00:01.23');
  });
}
