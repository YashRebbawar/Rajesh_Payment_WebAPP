function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast'+(type==='error'?' error':'');
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>t.classList.remove('show'),3500);
}
const registerForm=document.getElementById('register-form');
const allowedDomains=(registerForm?.dataset.allowedEmailDomains||'')
  .split(',')
  .map(domain=>domain.trim().toLowerCase())
  .filter(Boolean);
document.querySelectorAll('.pw-toggle').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const inp=document.getElementById(btn.dataset.target);
    inp.type=inp.type==='password'?'text':'password';
    btn.textContent=inp.type==='password'?'👁':'🙈';
  });
});
const pwInput=document.getElementById('register-password');
const strengthFill=document.getElementById('pw-strength-fill');
const rules={length:v=>v.length>=8&&v.length<=15,case:v=>/[a-z]/.test(v)&&/[A-Z]/.test(v),number:v=>/\d/.test(v),special:v=>/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v)};
pwInput.addEventListener('input',function(){
  const v=this.value;let met=0;
  Object.keys(rules).forEach(key=>{
    const passes=rules[key](v);if(passes)met++;
    const el=document.querySelector(`[data-rule="${key}"]`);
    el.classList.toggle('met',passes);
    el.querySelector('.rule-icon').textContent=passes?'✓':'○';
  });
  const pct=(met/4)*100;
  strengthFill.style.width=pct+'%';
  strengthFill.style.background=pct<=25?'#c0392b':pct<=50?'#e67e22':pct<=75?'#f1c40f':'#2d7a4f';
});
document.getElementById('legal-docs-link').addEventListener('click',e=>{e.preventDefault();document.getElementById('terms-modal').classList.add('active');});
document.getElementById('close-modal').addEventListener('click',()=>document.getElementById('terms-modal').classList.remove('active'));
document.getElementById('terms-modal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});
registerForm?.addEventListener('submit',async function(e){
  e.preventDefault();
  const emailInput = document.querySelector('input[name="email"]');
  const emailField = emailInput.closest('.field');
  const emailErrorDiv = document.getElementById('email-error');
  const email = emailInput.value.trim().toLowerCase();
  const pw=pwInput.value;
  
  emailField.classList.remove('has-error');
  if (emailErrorDiv) emailErrorDiv.textContent = '';
  
  if(!Object.values(rules).every(fn=>fn(pw))){showToast('Password does not meet all requirements.','error');return;}
  
  const emailDomain = email.split('@')[1];
  if(allowedDomains.length && (!emailDomain || !allowedDomains.includes(emailDomain))){
    const errorMsg = `Email domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`;
    emailField.classList.add('has-error');
    if (emailErrorDiv) emailErrorDiv.textContent = errorMsg;
    return;
  }
  
  const btn=document.getElementById('register-btn');
  btn.classList.add('loading');btn.disabled=true;
  const formData = new FormData(this);
  const csrfToken = formData.get('csrf_token');
  const data=Object.fromEntries(formData);
  data.email = email;
  delete data.csrf_token;
  try{
    const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken},body:JSON.stringify(data)});
    const result=await res.json();
    if(result.success){showToast('Account created! Redirecting…');setTimeout(()=>window.location.href=result.redirect||'/signin',1500);}
    else{
      if(result.message.includes('domain')){
        emailField.classList.add('has-error');
        if (emailErrorDiv) emailErrorDiv.textContent = result.message;
      } else {
        showToast(result.message||'Registration failed.','error');
      }
      btn.classList.remove('loading');btn.disabled=false;
    }
  }catch{
    showToast('Connection error. Please try again.','error');
    btn.classList.remove('loading');btn.disabled=false;
  }
});
document.getElementById('google-register').addEventListener('click',function(){
  this.disabled=true;
  this.innerHTML='<span style="width:18px;height:18px;border:2px solid rgba(26,21,16,0.2);border-top-color:var(--ink);border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;"></span> Connecting…';
  setTimeout(()=>window.location.href='/auth/google',800);
});

const emailInput = document.querySelector('input[name="email"]');
if(emailInput){
 emailInput.addEventListener('blur', function(){
    const email = this.value.trim().toLowerCase();
    const emailField = this.closest('.field');
    const emailErrorDiv = document.getElementById('email-error');
    
    if(!email){
      emailField.classList.remove('has-error');
      if (emailErrorDiv) emailErrorDiv.textContent = '';
      return;
    }
    
    const emailDomain = email.split('@')[1];
    
    if(allowedDomains.length && (!emailDomain || !allowedDomains.includes(emailDomain))){
      const errorMsg = `Email domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`;
      emailField.classList.add('has-error');
      if (emailErrorDiv) emailErrorDiv.textContent = errorMsg;
    } else {
      emailField.classList.remove('has-error');
      if (emailErrorDiv) emailErrorDiv.textContent = '';
    }
  });
}

// ======================================================
// ===== LIVE TRADING TERMINAL ENGINE ==================
// ======================================================
const PAIRS={
  EURUSD:{base:1.17000,pip:0.0001,dec:5,label:'EUR / USD · SPOT',vol:'2.4M'},
  XAUUSD:{base:4939.19,pip:0.10,dec:2,label:'XAU / USD · SPOT',vol:'840K'},
  BTCUSD:{base:112228,pip:1,dec:0,label:'BTC / USD · SPOT',vol:'320K'},
};
let activePair='XAUUSD';
let currentPrice=PAIRS.XAUUSD.base;
let candles=[];let candleTick=0;

function initCandles(pair){
  const cfg=PAIRS[pair];
  currentPrice=cfg.base+(Math.random()-0.5)*cfg.pip*20;
  candles=[];let p=currentPrice;
  for(let i=0;i<40;i++){
    const o=p;const move=(Math.random()-0.48)*cfg.pip*30;const c=o+move;
    const h=Math.max(o,c)+Math.random()*cfg.pip*8;const l=Math.min(o,c)-Math.random()*cfg.pip*8;
    candles.push({o,h,l,c});p=c;
  }
  currentPrice=p;candleTick=0;
}

const canvas=document.getElementById('chartCanvas');
const ctx=canvas.getContext('2d');
function resizeCanvas(){
  const w=canvas.parentElement.clientWidth-16;
  canvas.width=w*window.devicePixelRatio;canvas.height=110*window.devicePixelRatio;
  canvas.style.width=w+'px';canvas.style.height='110px';
  ctx.scale(window.devicePixelRatio,window.devicePixelRatio);
}
function drawChart(){
  resizeCanvas();const W=canvas.clientWidth;const H=110;
  const RIGHT_GUTTER=44;
  const plotW=Math.max(10,W-RIGHT_GUTTER);
  ctx.clearRect(0,0,W,H);
  const visible=candles.slice(-36);
  const prices=visible.flatMap(c=>[c.h,c.l]);
  const hi=Math.max(...prices);const lo=Math.min(...prices);
  const range=hi-lo||1;const pad=range*0.1;
  const toY=v=>H-((v-(lo-pad))/((hi+pad)-(lo-pad)))*H;
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(let i=1;i<4;i++){const y=Math.round(H*i/4)+0.5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const labels=document.getElementById('chartYLabels');
  labels.innerHTML='';
  for(let i=0;i<4;i++){
    const val=hi+pad-((hi+pad-(lo-pad))*(i/3));
    const d=document.createElement('span');
    d.textContent=val.toFixed(PAIRS[activePair].dec>2?4:2);
    labels.appendChild(d);
  }
  const cw=(plotW-4)/visible.length;
  visible.forEach((c,i)=>{
    const x=i*cw+cw/2;const isUp=c.c>=c.o;
    const col=isUp?'#4ade80':'#f87171';
    const bodyTop=toY(Math.max(c.o,c.c));const bodyBot=toY(Math.min(c.o,c.c));
    const bodyH=Math.max(bodyBot-bodyTop,1);
    const wickTop=toY(c.h);const wickBot=toY(c.l);
    ctx.strokeStyle=col;ctx.lineWidth=0.8;ctx.globalAlpha=0.7;
    ctx.beginPath();ctx.moveTo(x,wickTop);ctx.lineTo(x,wickBot);ctx.stroke();
    ctx.globalAlpha=1;
    ctx.fillStyle=isUp?'rgba(74,222,128,0.85)':'rgba(248,113,113,0.85)';
    ctx.fillRect(x-cw*0.3,bodyTop,cw*0.6,bodyH);
  });
  const py=toY(currentPrice);
  ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1;ctx.setLineDash([3,4]);
  ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(plotW,py);ctx.stroke();ctx.setLineDash([]);
  const cfg=PAIRS[activePair];const tag=currentPrice.toFixed(cfg.dec>2?4:2);
  const tw=ctx.measureText(tag).width+10;
  ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(W-tw-2,py-8,tw,16);
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='8px sans-serif';ctx.fillText(tag,W-tw+2,py+3);
}
function renderBook(){
  const cfg=PAIRS[activePair];const rows=document.getElementById('bookRows');rows.innerHTML='';
  const sells=[];const buys=[];
  for(let i=0;i<4;i++){
    sells.push({p:currentPrice+(i+1)*cfg.pip*2,sz:(Math.random()*3+0.5).toFixed(2)});
    buys.push({p:currentPrice-(i+1)*cfg.pip*2,sz:(Math.random()*3+0.5).toFixed(2)});
  }
  const maxSz=4;
  sells.reverse().forEach(r=>{
    const d=document.createElement('div');d.className='brow sell';
    const pct=(parseFloat(r.sz)/maxSz*100).toFixed(0);
    const total=(parseFloat(r.sz)*r.p).toFixed(0);
    d.innerHTML=`<div class="brow-fill" style="width:${pct}%"></div><span>${r.p.toFixed(cfg.dec>2?4:2)}</span><span>${r.sz}</span><span>${total}</span>`;
    rows.appendChild(d);
  });
  buys.forEach(r=>{
    const d=document.createElement('div');d.className='brow buy';
    const pct=(parseFloat(r.sz)/maxSz*100).toFixed(0);
    const total=(parseFloat(r.sz)*r.p).toFixed(0);
    d.innerHTML=`<div class="brow-fill" style="width:${pct}%"></div><span>${r.p.toFixed(cfg.dec>2?4:2)}</span><span>${r.sz}</span><span>${total}</span>`;
    rows.appendChild(d);
  });
}
const MAX_FEED=6;
function addFeedRow(price,up){
  const cfg=PAIRS[activePair];
  const container=document.getElementById('feedRows');
  const size=(Math.random()*4+0.1).toFixed(2);const side=up?'buy':'sell';
  const now=new Date();
  const ts=String(now.getUTCHours()).padStart(2,'0')+':'+String(now.getUTCMinutes()).padStart(2,'0')+':'+String(now.getUTCSeconds()).padStart(2,'0');
  const row=document.createElement('div');row.className='frow';
  row.innerHTML=`<span class="frow-side ${side}">${side.toUpperCase()}</span><span class="frow-price">${price.toFixed(cfg.dec>2?4:2)}</span><span class="frow-size">${size}</span><span class="frow-time">${ts}</span>`;
  container.insertBefore(row,container.firstChild);
  while(container.children.length>MAX_FEED)container.removeChild(container.lastChild);
}
let prevPrice=currentPrice;
function tick(){
  const cfg=PAIRS[activePair];
  const move=(Math.random()-0.495)*cfg.pip*8;currentPrice+=move;
  const up=currentPrice>=prevPrice;
  const el=document.getElementById('mainPrice');
  el.textContent=currentPrice.toFixed(cfg.dec>2?5:2);
  el.classList.remove('flash-up','flash-down');void el.offsetWidth;
  el.classList.add(up?'flash-up':'flash-down');
  setTimeout(()=>el.classList.remove('flash-up','flash-down'),300);
  const pctChange=((currentPrice-cfg.base)/cfg.base*100);
  const badge=document.getElementById('changeBadge');
  badge.textContent=(pctChange>=0?'+':'')+pctChange.toFixed(2)+'%';
  badge.className='price-badge '+(pctChange>=0?'up':'down');
  const half=cfg.pip*0.7;
  document.getElementById('bidVal').textContent=(currentPrice-half).toFixed(cfg.dec>2?5:2);
  document.getElementById('askVal').textContent=(currentPrice+half).toFixed(cfg.dec>2?5:2);
  document.getElementById('spreadVal').textContent=(cfg.pip*14000).toFixed(1);
  candleTick++;
  if(candleTick>8){
    candles.push({o:prevPrice,h:Math.max(prevPrice,currentPrice)+Math.random()*cfg.pip*3,l:Math.min(prevPrice,currentPrice)-Math.random()*cfg.pip*3,c:currentPrice});
    if(candles.length>60)candles.shift();candleTick=0;
  }else{
    const last=candles[candles.length-1];
    last.c=currentPrice;last.h=Math.max(last.h,currentPrice);last.l=Math.min(last.l,currentPrice);
  }
  drawChart();
  if(Math.random()<0.4)addFeedRow(currentPrice,up);
  if(Math.random()<0.15)renderBook();
  prevPrice=currentPrice;
}
function switchPair(btn,pair){
  document.querySelectorAll('.pair-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');activePair=pair;
  const cfg=PAIRS[pair];
  document.getElementById('pairLabel').textContent=cfg.label;
  document.getElementById('volVal').textContent=cfg.vol;
  document.getElementById('feedRows').innerHTML='';
  initCandles(pair);drawChart();renderBook();
}
initCandles('XAUUSD');drawChart();renderBook();addFeedRow(currentPrice,true);
setInterval(tick,600);
window.addEventListener('resize',drawChart);
