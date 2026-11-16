'use strict';
// Run in the application's isolated Chromium page via executeJavaScript.
function auditTextContrast(){
  const rgba=value=>{const m=value.match(/[\d.]+/g);return m?[Number(m[0]),Number(m[1]),Number(m[2]),m.length>3?Number(m[3]):1]:[0,0,0,0];};
  const blend=(a,b)=>a.slice(0,3).map((n,i)=>n*a[3]+b[i]*(1-a[3]));
  const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const dialog=document.querySelector('#actionDialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1),root=dialog||document.body,failures=[],samples=[];
  for(const el of root.querySelectorAll('*')){
    if(el.closest('svg,[hidden],.sr-only,[disabled]'))continue;
    const r=el.getBoundingClientRect(),style=getComputedStyle(el);if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth||style.visibility==='hidden')continue;
    const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim(),input=el.matches('input:not([type=checkbox]),textarea,select');
    if(!text&&!input)continue;if(el.closest('.brand'))continue;
    const ancestors=[];for(let n=el;n;n=n.parentElement)ancestors.unshift(n);
    let background=[255,255,255],opacity=1;for(const a of ancestors){const s=getComputedStyle(a);background=blend(rgba(s.backgroundColor),background);opacity*=Number(s.opacity);}
    if(opacity===0)continue;
    const inspect=(color,content,pseudoOpacity=1)=>{const fg=rgba(color);fg[3]*=opacity*pseudoOpacity;const contrast=ratio(blend(fg,background),background),size=parseFloat(style.fontSize),weight=Number(style.fontWeight)||400,minimum=size>=24||(size>=18.6667&&weight>=700)?3:4.5,record={element:el.id||el.className||el.tagName,text:content.slice(0,70),fontPx:size,contrast:Number(contrast.toFixed(3)),minimum,color,background:background.map(Math.round)};samples.push(record);if(contrast<minimum)failures.push(record);};
    if(text||el.value)inspect(style.color,text||el.value);
    if(input&&el.placeholder&&!el.value){const ps=getComputedStyle(el,'::placeholder');inspect(ps.color,'placeholder: '+el.placeholder,Number(ps.opacity));}
  }
  return {checked:samples.length,failures,samples};
}
module.exports={auditTextContrast};
