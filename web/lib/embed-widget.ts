// The drop-in chat widget served at /api/embed/widget. Vanilla JS, shadow-DOM isolated (so the host
// page's CSS can't touch it and vice-versa), zero deps. Reads data-token/title/greeting/accent from
// its own <script> tag and talks to /api/embed on this host. `base` is baked in at serve time.
export const embedWidgetJs = (base: string): string => `(function(){
  var s=document.currentScript||document.querySelector('script[data-token]'); if(!s) return;
  var token=s.getAttribute('data-token'); if(!token) return;
  var title=s.getAttribute('data-title')||'Assistant';
  var greeting=s.getAttribute('data-greeting')||'Hi! How can I help?';
  var accent=s.getAttribute('data-accent')||'#4f46e5';
  var API='${base}/api/embed';
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
  var host=document.createElement('div'); document.body.appendChild(host);
  var sh=host.attachShadow({mode:'open'});
  sh.innerHTML='<style>'
    +':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}'
    +'.b{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:'+accent+';color:#fff;border:none;cursor:pointer;font-size:24px;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:2147483647}'
    +'.p{position:fixed;bottom:88px;right:20px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#fff;color:#111;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:2147483647}'
    +'.p.open{display:flex}.h{background:'+accent+';color:#fff;padding:14px 16px;font-weight:600}'
    +'.m{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}'
    +'.msg{padding:9px 12px;border-radius:12px;max-width:82%;white-space:pre-wrap;line-height:1.4;font-size:14px}'
    +'.u{align-self:flex-end;background:'+accent+';color:#fff}.a{align-self:flex-start;background:#f1f1f4;color:#111}'
    +'.f{display:flex;gap:8px;padding:12px;border-top:1px solid #eee}'
    +'.f input{flex:1;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;outline:none}'
    +'.f button{background:'+accent+';color:#fff;border:none;border-radius:10px;padding:0 14px;cursor:pointer}'
    +'</style>'
    +'<button class="b" aria-label="Open chat">&#128172;</button>'
    +'<div class="p"><div class="h">'+esc(title)+'</div><div class="m"></div>'
    +'<div class="f"><input placeholder="Type a message…" aria-label="Message"/><button>Send</button></div></div>';
  var b=sh.querySelector('.b'),p=sh.querySelector('.p'),m=sh.querySelector('.m'),inp=sh.querySelector('input'),snd=sh.querySelector('.f button');
  var msgs=[],busy=false,greeted=false;
  function add(role,text){var d=document.createElement('div');d.className='msg '+(role==='user'?'u':'a');d.textContent=text;m.appendChild(d);m.scrollTop=m.scrollHeight;return d;}
  b.onclick=function(){p.classList.toggle('open');if(p.classList.contains('open')){if(!greeted){greeted=true;add('assistant',greeting);}inp.focus();}};
  function send(){var t=inp.value.trim(); if(!t||busy) return; inp.value=''; add('user',t); msgs.push({role:'user',content:t}); busy=true;
    var ph=add('assistant','…');
    fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:token,messages:msgs})})
      .then(function(r){return r.json();})
      .then(function(j){ ph.textContent=(j&&j.ok)?j.reply:((j&&j.error)||'Sorry, something went wrong.'); if(j&&j.ok) msgs.push({role:'assistant',content:j.reply}); })
      .catch(function(){ ph.textContent='Network error — please try again.'; })
      .finally(function(){ busy=false; });
  }
  snd.onclick=send; inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); send(); } });
})();`;
