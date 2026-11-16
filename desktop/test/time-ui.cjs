'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'..','.test-data','time-ui');fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1440,height:1080,useContentSize:true,webPreferences:{partition:'time-ui-'+Date.now(),offscreen:true,backgroundThrottling:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});win.webContents.setAudioMuted(true);
  const errors=[];win.webContents.on('console-message',(_event,...args)=>{const d=args[0];if(d&&typeof d==='object'&&d.level==='error')errors.push(d.message);});
  const page=(fn,arg)=>win.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)??'undefined'})`);
  const state=()=>page(()=>JSON.parse(localStorage.getItem('shixu.studio.board.v1')));
  const painted=async()=>{await page(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));};
  const click=async selector=>{await page(selector=>document.querySelector(selector).scrollIntoView({block:'nearest',inline:'nearest'}),selector);await painted();const p=await page(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};},selector);win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await painted();};
  const waitFor=async predicate=>{const until=Date.now()+5000;while(!(await page(predicate))){if(Date.now()>until)throw Error('UI state did not become ready');await new Promise(resolve=>setTimeout(resolve,30));}};
  const reload=()=>new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.webContents.reload();});
  try{
    await win.loadFile(path.resolve(__dirname,'..','..','web','index.html'));const board=(await state()).lists;
    await click('#openTime');assert.equal(await page(()=>document.getElementById('timePage').hidden),false);assert.equal(await page(()=>document.getElementById('workspaceSearch').hidden),true);
    await click('#timeTestSound');await waitFor(()=>/就緒|無法|支援/.test(document.getElementById('timeAudioStatus').textContent));
    // Four tabs; exactly one tool panel is shown at a time.
    const panels=()=>page(()=>[...document.querySelectorAll('[data-time-panel]')].filter(p=>!p.hidden).map(p=>p.dataset.timePanel));
    assert.deepEqual(await panels(),['alarm']);await click('#timeTabStopwatch');assert.deepEqual(await panels(),['stopwatch']);assert.equal(await page(()=>document.getElementById('timeTabStopwatch').getAttribute('aria-selected')),'true');
    await page(()=>document.getElementById('timeTabStopwatch').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));assert.deepEqual(await panels(),['alarm']);
    // Use a genuine one-second countdown; verify actual scheduling and rendering.
    await click('#timeTabTimer');
    await page(()=>{document.getElementById('timerHours').value='0';document.getElementById('timerMinutes').value='0';document.getElementById('timerSeconds').value='1';});await click('#timerStart');assert((await state()).timeTools.timer.deadline!==null);
    await waitFor(()=>JSON.parse(localStorage.getItem('shixu.studio.board.v1')).timeTools.alerts.some(a=>a.kind==='timer'));assert.equal(await page(()=>document.getElementById('timeBanner').hidden),false);assert.equal(await page(()=>document.getElementById('timerDisplay').textContent),'00:00');
    await click('#timeBannerDismiss');assert.equal((await state()).timeTools.alerts.length,0);
    // A future alarm is created and edited through its visible form.
    await click('#timeTabAlarm');
    await page(()=>{const d=new Date(Date.now()+60000),pad=v=>String(v).padStart(2,'0');document.getElementById('alarmLabel').value='起身喝杯水';document.getElementById('alarmAt').value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;});await click('#alarmSubmit');assert.equal((await state()).timeTools.alarms.length,1);
    await click('[data-alarm-edit]');await page(()=>document.getElementById('alarmLabel').value='喝水與伸展');await click('#alarmSubmit');assert.equal((await state()).timeTools.alarms[0].label,'喝水與伸展');await click('[data-alarm-toggle]');assert.equal((await state()).timeTools.alarms[0].enabled,false);await click('[data-alarm-toggle]');
    await click('[data-alarm-delete]');await click('#actionCancel');assert.equal((await state()).timeTools.alarms.length,1);
    await click('#timeTabStopwatch');await click('#stopwatchStart');assert.equal(await page(()=>document.getElementById('timeTabStopwatch').classList.contains('live')),true);await waitFor(()=>document.getElementById('stopwatchDisplay').textContent!=='00:00.00');await click('#stopwatchLap');await click('#stopwatchLap');await click('#stopwatchStart');let s=(await state()).timeTools.stopwatch;assert.equal(s.startedAt,null);assert.equal(s.laps.length,2);assert(s.laps[1].totalMs>=s.laps[0].totalMs);
    await click('#stopwatchReset');await click('#actionCancel');assert.equal((await state()).timeTools.stopwatch.laps.length,2);
    await click('#timeTabPomodoro');await page(()=>{document.getElementById('pomFocus').value='1';document.getElementById('pomBreak').value='1';document.getElementById('pomRounds').value='2';document.getElementById('pomAuto').checked=true;});await click('#pomStart');assert((await state()).timeTools.pomodoro.deadline!==null);await click('#pomStart');assert.equal((await state()).timeTools.pomodoro.deadline,null);await click('#pomStart');
    // Seed a delayed persisted deadline, as when restoring a suspended page.
    await page(()=>{const s=JSON.parse(localStorage.getItem('shixu.studio.board.v1'));s.timeTools.pomodoro.deadline=Date.now()-500;s.timeTools.alarms[0].at=Date.now()-1000;localStorage.setItem('shixu.studio.board.v1',JSON.stringify(s));});await reload();
    await waitFor(()=>JSON.parse(localStorage.getItem('shixu.studio.board.v1')).timeTools.alerts.length>=2);s=(await state()).timeTools;assert.equal(s.pomodoro.phase,'break');assert(s.pomodoro.deadline>Date.now());assert.equal(s.alarms[0].enabled,false);assert.equal(s.stopwatch.laps.length,2);
    await click('#openTime');await click('#timeTabPomodoro');assert.equal(await page(()=>document.getElementById('pomMode').textContent),'休息時間');
    await click('#pomReset');await click('#actionConfirm');assert.equal((await state()).timeTools.pomodoro.deadline,null);assert.equal((await state()).timeTools.pomodoro.phase,'focus');
    await page(()=>{document.getElementById('pomFocus').value='25';document.getElementById('pomBreak').value='5';document.getElementById('pomRounds').value='4';document.getElementById('timerMinutes').value='5';document.getElementById('timerSeconds').value='0';});
    await click('#timeTabTimer');await click('#timerStart');await click('#timerStart');assert((await state()).timeTools.timer.remainingMs>0);assert.equal((await state()).timeTools.timer.deadline,null);
    await click('#openNotesTop');assert.equal(await page(()=>document.getElementById('timePage').hidden),true);await click('#openTime');assert.equal(await page(()=>document.getElementById('notesPanel').hidden),true);assert.deepEqual((await state()).lists,board);
    await page(()=>document.querySelector('.time-grid').scrollTo(0,0));await painted();fs.writeFileSync(path.join(output,'desktop.png'),(await win.webContents.capturePage()).toPNG());
    await click('#timeBannerView');await painted();assert.equal(await page(()=>document.querySelector('#timeTabs [aria-selected="true"]').dataset.timeTab),(await state()).timeTools.alerts.at(-1).kind);fs.writeFileSync(path.join(output,'reminders.png'),(await win.webContents.capturePage()).toPNG());
    win.setContentSize(390,844);await painted();await page(()=>document.querySelector('.time-grid').scrollTo(0,0));await painted();const mobile=await page(()=>({width:innerWidth,body:document.body.scrollWidth,page:document.getElementById('timePage').getBoundingClientRect().width,gridColumns:getComputedStyle(document.querySelector('.time-grid')).gridTemplateColumns}));assert.equal(mobile.width,390);assert(mobile.body<=390);assert.equal(mobile.page,390);assert(!mobile.gridColumns.includes(' '));
    fs.writeFileSync(path.join(output,'mobile.png'),(await win.webContents.capturePage()).toPNG());
    await click('#timeTabTimer');await click('#timerStart');assert((await state()).timeTools.timer.deadline!==null);await click('#timerStart');assert.equal((await state()).timeTools.timer.deadline,null);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:'four tool tabs and arrow keys, native tool controls, actual countdown completion, audio setup (muted test output), alarm edit/toggle, stopwatch/laps, Pomodoro pause/resume and overdue restore, reset confirmation, cross-page persistence, global reminders, desktop/mobile layout',screenshots:['desktop.png','reminders.png','mobile.png'].map(file=>path.join(output,file))},null,2));win.destroy();app.quit();
  }catch(error){console.error(error);win.destroy();app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
