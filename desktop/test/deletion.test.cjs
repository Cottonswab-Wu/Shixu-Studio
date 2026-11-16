'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {boot}=require('../../web/verify.cjs');
const KEY='shixu.studio.board.v1',event={preventDefault(){}};
const plain=x=>JSON.parse(JSON.stringify(x));
for(const target of ['web','desktop']){
  const scriptSource=target==='web'?fs.readFileSync(path.resolve(__dirname,'../../web/index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]:fs.readFileSync(path.resolve(__dirname,'../app/renderer.js'),'utf8');
  const make=()=>boot({scriptSource});
  const check=(name,run)=>test(`${target}: ${name}`,run);
  check('All five deletion types remain unchanged until confirmation and support cancellation',()=>{
    for(const kind of ['card','todo','list','note','alarm']){
      const h=make(),card=h.app.state.lists[0].cards[1];let request;
      if(kind==='card')request=()=>h.app.requestDeleteCard(card.id);
      if(kind==='todo')request=()=>h.app.requestDeleteTodo(card.id,card.todos[0].id);
      if(kind==='list')request=()=>h.app.requestDeleteList(h.app.state.lists[0].id);
      if(kind==='note'){const note=h.app.addNote('確認前保留');request=()=>h.app.deleteNote(note.id);}
      if(kind==='alarm'){h.app.putAlarm('確認前保留',Date.now()+60000);const alarm=h.app.state.timeTools.alarms[0];request=()=>h.app.removeAlarm(alarm.id);}
      const before=h.store.get(KEY);request();assert(h.get('actionDialog').open,kind);assert.equal(h.get('actionWarning').hidden,false,kind);assert.equal(h.store.get(KEY),before,kind);
      h.get('actionCancel').onclick();assert.equal(h.store.get(KEY),before,kind);assert.equal(h.get('actionDialog').open,false,kind);
      request();h.get('actionDialog').dispatch('cancel',event);assert.equal(h.store.get(KEY),before,kind);assert.equal(h.get('actionDialog').open,false,kind);
    }
  });
  check('Card confirmation deletes exactly the target and undo restores nested content',async()=>{
    const h=make(),card=h.app.state.lists[0].cards[1],original=plain(card),index=h.app.state.lists[0].cards.indexOf(card);h.app.openCard(card.id);h.get('deleteCard').onclick();assert.equal(h.get('cardDialog').open,true);
    await h.get('actionForm').onsubmit(event);assert.equal(h.app.findCard(card.id),null);assert.equal(h.get('cardDialog').open,false);
    h.get('toastUndo').onclick();assert.deepEqual(plain(h.app.state.lists[0].cards[index]),original);assert.doesNotThrow(()=>h.app.validate(JSON.parse(h.store.get(KEY))));
  });
  check('Todo confirmation preserves its checked state and exact order through undo',()=>{
    const h=make(),card=h.app.state.lists[0].cards[1],todo=card.todos[0],before=plain(card.todos);h.app.activate(card.id);h.get('todoList').onclick({target:{closest:()=>({dataset:{deleteTodo:todo.id}})}});
    assert.deepEqual(plain(card.todos),before);h.get('actionForm').onsubmit(event);assert.equal(card.todos.length,before.length-1);h.get('toastUndo').onclick();assert.deepEqual(plain(card.todos),before);
  });
  check('List confirmation explains the card count and restores the entire list',()=>{
    const h=make(),list=h.app.state.lists[0],before=plain(list);h.app.requestDeleteList(list.id);assert(h.get('actionDescription').textContent.includes(`${list.cards.length} 張卡片`));h.get('actionForm').onsubmit(event);assert(!h.app.state.lists.some(l=>l.id===list.id));h.get('toastUndo').onclick();assert.deepEqual(plain(h.app.state.lists[0]),before);
  });
  check('Backdrop keeps the confirmation open, and cancel and close clear the callback',()=>{
    const h=make(),card=h.app.state.lists[0].cards[1],before=h.store.get(KEY);
    h.app.requestDeleteCard(card.id);h.get('actionDialog').dispatch('click',{target:h.get('actionDialog')});assert(h.get('actionDialog').open);assert.equal(h.store.get(KEY),before);
    h.get('actionDialog').dispatch('cancel',event);assert(!h.get('actionDialog').open);h.get('actionForm').onsubmit(event);assert.equal(h.store.get(KEY),before);
    h.app.requestDeleteCard(card.id);h.get('actionDialog').close();h.get('actionDialog').showModal();h.get('actionForm').onsubmit(event);assert.equal(h.store.get(KEY),before);
  });
  check('Removed targets cannot cause a different last item to be deleted',async()=>{
    const h=make(),list=h.app.state.lists[0],card=list.cards[1],todo=card.todos[0];h.app.requestDeleteTodo(card.id,todo.id);card.todos.splice(0,1);const todos=plain(card.todos);h.get('actionForm').onsubmit(event);assert.deepEqual(plain(card.todos),todos);
    h.app.requestDeleteCard(card.id);list.cards.splice(list.cards.indexOf(card),1);const cards=plain(list.cards);await h.get('actionForm').onsubmit(event);assert.deepEqual(plain(list.cards),cards);
  });
  check('Destructive resets use a warning and cancellation preserves elapsed data',()=>{
    const h=make();h.app.startStopwatch();h.app.lapStopwatch(Date.now()+500);const before=h.store.get(KEY);h.get('stopwatchReset').onclick();assert(h.get('actionDialog').open);assert.equal(h.get('actionWarning').hidden,false);assert(h.get('actionDescription').textContent.includes('無法復原'));h.get('actionCancel').onclick();assert.equal(h.store.get(KEY),before);
  });
}
