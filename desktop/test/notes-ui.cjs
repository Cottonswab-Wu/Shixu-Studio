'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.resolve(__dirname,'..','.test-data','notes-ui');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1280,height:900,useContentSize:true,webPreferences:{partition:'notes-ui-'+Date.now(),offscreen:true,backgroundThrottling:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  const errors=[];win.webContents.on('console-message',(_event,...args)=>{const details=args[0];if(details&&typeof details==='object'&&details.level==='error')errors.push(details.message);});
  const page=(fn,arg)=>win.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)??'undefined'})`);
  const snapshot=()=>page(()=>({board:JSON.parse(localStorage.getItem('shixu.studio.board.v1')),open:!document.getElementById('notesPanel').hidden,cardPageHidden:document.getElementById('kanbanPage').hidden,editor:document.getElementById('noteDialog').open,rendered:document.querySelectorAll('.sticky-note').length}));
  const painted=async()=>{await page(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));};
  const point=async selector=>{await page(s=>document.querySelector(s).scrollIntoView({block:'nearest',inline:'nearest'}),selector);await painted();return page(selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing UI target: '+selector);const r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};},selector);};
  const click=async selector=>{const p=await point(selector);win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await painted();};
  const gesture=async(selector,dx,dy,cancel=false)=>{
    const start=await point(selector);win.webContents.sendInputEvent({type:'mouseMove',...start});win.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});await painted();
    win.webContents.sendInputEvent({type:'mouseMove',x:start.x+dx,y:start.y+dy,movementX:dx,movementY:dy});await painted();
    if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESC'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESC'});await painted();}
    win.webContents.sendInputEvent({type:'mouseUp',x:start.x+dx,y:start.y+dy,button:'left',clickCount:1});await painted();
  };
  const field=async(text,color)=>page(({text,color})=>{const el=document.getElementById('noteEditorText');el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('noteEditorColor').value=color;},{text,color});
  const noteSelector=(index,kind)=>`.sticky-note:nth-child(${index+1}) [data-note-${kind}]`;
  const reposition=async(index,x,y)=>{const n=(await snapshot()).board.notes[index];await gesture(noteSelector(index,'drag'),x-n.x,y-n.y);};
  try{
    await win.loadFile(path.resolve(__dirname,'..','..','web','index.html'));assert.equal((await snapshot()).rendered,0);
    await click('#openNotes');assert.equal((await snapshot()).cardPageHidden,true);
    await click('#addNote');assert((await snapshot()).editor);assert.equal((await snapshot()).board.notes.length,0);
    await field('取消不建立便簽','pink');await click('#noteEditorCancel');assert.equal((await snapshot()).board.notes.length,0);
    await click('#addNote');await field('週末的三件小事\n買一本書、散步、留點空白。','green');
    fs.writeFileSync(path.join(output,'editor.png'),(await win.webContents.capturePage()).toPNG());
    await click('#noteEditorDone');let current=await snapshot();assert.equal(current.board.notes.length,1);assert(!current.editor);
    const first=current.board.notes[0];await gesture(noteSelector(0,'drag'),70,50);current=await snapshot();assert.equal(current.board.notes[0].x,first.x+70,'First note must move with native mouse input');assert.equal(current.board.notes[0].y,first.y+50);
    await click(noteSelector(0,'pin'));assert((await snapshot()).board.notes[0].pinned);
    const pinned=(await snapshot()).board.notes[0];await gesture(noteSelector(0,'drag'),30,20);assert.equal((await snapshot()).board.notes[0].x,pinned.x+30,'Pinning must not block dragging');
    await gesture(noteSelector(0,'resize'),100,90);current=await snapshot();assert.equal(current.board.notes[0].width,360);assert.equal(current.board.notes[0].height,336);
    const beforeCancel=JSON.stringify(current.board.notes);await gesture(noteSelector(0,'resize'),35,25,true);assert.equal(JSON.stringify((await snapshot()).board.notes),beforeCancel,'Escape must cancel resize');
    await reposition(0,20,20);
    await click(noteSelector(0,'edit'));await field('不應保留的編輯','pink');await click('#noteEditorCancel');assert((await snapshot()).board.notes[0].text.includes('三件小事'));
    await click(noteSelector(0,'edit'));await field('週末的三件小事\n買一本書、散步、留點空白。\n完成後，把想法放回生活裡。','green');await click('#noteEditorDone');assert.equal((await snapshot()).board.notes[0].width,360);
    await click('#addNote');await field('下一個好點子\n\n想到就記下來，不急著一次做完。','yellow');await click('#noteEditorDone');await reposition(1,440,20);
    await click('#addNote');await field('提醒自己\n\n重要的想法，記下就不怕忘記。','blue');await click('#noteEditorDone');await reposition(2,440,290);await gesture(noteSelector(2,'resize'),-20,-36);
    await click(noteSelector(1,'delete'));await click('#actionCancel');assert.equal((await snapshot()).board.notes.length,3);
    await click(noteSelector(1,'delete'));assert.equal(await page(()=>document.getElementById('actionDialog').open),true);await click('#actionConfirm');assert.equal((await snapshot()).board.notes.length,2);
    await click('#toastUndo');assert.equal((await snapshot()).board.notes.length,3);
    const saved=(await snapshot()).board;
    await click('#closeNotes');assert.equal((await snapshot()).cardPageHidden,false);assert.equal((await snapshot()).open,false);
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.webContents.reload();});assert.deepEqual((await snapshot()).board,saved);
    await click('#openNotesTop');await gesture(noteSelector(0,'drag'),10,10);assert.equal((await snapshot()).board.notes[0].x,saved.notes[0].x+10,'First note remains movable after reload');await reposition(0,20,20);
    await page(()=>{const search=document.getElementById('search');search.value='下一個好點子';search.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await snapshot()).rendered,1);
    await page(()=>{const search=document.getElementById('search');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('notesViewport').scrollTo(0,0);});await painted();
    const desktop=await page(()=>({notes:document.getElementById('notesPanel').getBoundingClientRect().width,main:document.querySelector('.main').getBoundingClientRect().width,heights:[...document.querySelectorAll('.sticky-note')].map(el=>el.getBoundingClientRect().height)}));assert.equal(desktop.notes,desktop.main);assert.deepEqual(desktop.heights,[336,246,210]);
    fs.writeFileSync(path.join(output,'desktop.png'),(await win.webContents.capturePage()).toPNG());
    win.setContentSize(390,844);await painted();const mobile=await page(()=>({width:innerWidth,pageWidth:document.body.scrollWidth,notesWidth:document.getElementById('notesPanel').getBoundingClientRect().width,sidebarRight:document.getElementById('sidebar').getBoundingClientRect().right}));assert.equal(mobile.width,390);assert(mobile.pageWidth<=390);assert.equal(mobile.notesWidth,390);assert(mobile.sidebarRight<=1);
    fs.writeFileSync(path.join(output,'mobile.png'),(await win.webContents.capturePage()).toPNG());
    await click('#addNote');assert((await snapshot()).editor);await field('手機也能輸入便簽','pink');await click('#noteEditorDone');assert.equal((await snapshot()).board.notes.length,4);
    // Reproduce an existing first note from the earlier schema-2 UI: pinned,
    // without width/height. Migration must preserve it and permit native dragging.
    win.setContentSize(1280,900);await painted();
    const legacy=await page(()=>{const s=JSON.parse(localStorage.getItem('shixu.studio.board.v1'));delete s.notes[0].width;delete s.notes[0].height;s.notes[0].pinned=true;localStorage.setItem('shixu.studio.board.v1',JSON.stringify(s));return s.notes[0];});
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.webContents.reload();});await click('#openNotesTop');
    await gesture(noteSelector(0,'drag'),40,30);assert.equal((await snapshot()).board.notes[0].x,legacy.x+40,'Existing first pinned note must remain draggable');
    await gesture(noteSelector(0,'resize'),50,40);assert.equal((await snapshot()).board.notes[0].width,310);assert.equal((await snapshot()).board.notes[0].height,286);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:'full notes workspace, dialog create/edit/cancel, first-note native mouse drag, pinned drag, native resize, Escape cancellation, delete/undo, reload with geometry, search, desktop/mobile layout',screenshots:['desktop.png','mobile.png','editor.png'].map(file=>path.join(output,file))},null,2));
    win.destroy();app.quit();
  }catch(error){console.error(error);win.destroy();app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
