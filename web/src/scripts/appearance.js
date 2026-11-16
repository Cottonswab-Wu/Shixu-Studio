const THEME_KEY='shixu.studio.theme';

function initializeAppearance(){
  const choice=$('themeChoice');
  function applyTheme(value){
    const theme=value==='whale'?'whale':'classic';
    document.body.dataset.theme=theme;
    choice.value=theme;
  }
  let savedTheme;
  try{savedTheme=localStorage.getItem(THEME_KEY);}catch{}
  applyTheme(savedTheme);
  choice.onchange=()=>{
    applyTheme(choice.value);
    try{localStorage.setItem(THEME_KEY,choice.value);}
    catch{toast('主題已切換，但無法儲存外觀設定。');}
  };
}
