// ── Toast ──
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast'+(type==='error'?' error':'');
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>t.classList.remove('show'),3500);
}

const passwordRules={
  length:v=>v.length>=8&&v.length<=15,
  case:v=>/[a-z]/.test(v)&&/[A-Z]/.test(v),
  number:v=>/\d/.test(v),
  special:v=>/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v)
};
function isPasswordValid(v){
  return Object.values(passwordRules).every(fn=>fn(v));
}

// ── Password toggle ──
document.querySelectorAll('.pw-toggle').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const inp=document.getElementById(btn.dataset.target);
    inp.type=inp.type==='password'?'text':'password';
    btn.textContent=inp.type==='password'?'👁':'🙈';
  });
});

// ── Sign in form ──
document.getElementById('signin-form').addEventListener('submit',async function(e){
  e.preventDefault();
  
  const emailInput = document.querySelector('#signin-form input[name="email"]');
  const passwordInput = document.querySelector('#signin-form input[name="password"]');
  const emailField = emailInput.closest('.field');
  const passwordField = passwordInput.closest('.field');
  const emailErrorDiv = document.getElementById('email-error');
  const passwordErrorDiv = document.getElementById('password-error');
  
  emailField.classList.remove('has-error');
  passwordField.classList.remove('has-error');
  emailErrorDiv.textContent = '';
  passwordErrorDiv.textContent = '';
  
  const email = emailInput.value.trim().toLowerCase();
  const emailDomain = email.split('@')[1];
  const allowedDomains = ['gmail.com', 'company.com'];
  
  if(!emailDomain || !allowedDomains.includes(emailDomain)){
    const errorMsg = `Email domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`;
    emailField.classList.add('has-error');
    emailErrorDiv.textContent = errorMsg;
    showToast(errorMsg, 'error');
    return;
  }
  
  const btn=document.getElementById('signin-btn');
  btn.classList.add('loading');btn.disabled=true;
  const data=Object.fromEntries(new FormData(this));
  data.email = email;
  try{
    const res=await fetch('/api/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await res.json();
    if(result.success){
      showToast('Signed in! Redirecting…');
      setTimeout(()=>window.location.href=result.redirect||'/my-accounts',1200);
    }
    else{
      if(result.message.toLowerCase().includes('credential')){
        passwordField.classList.add('has-error');
        passwordErrorDiv.textContent = result.message;
      }
      showToast(result.message||'Sign in failed.','error');
      btn.classList.remove('loading');btn.disabled=false;
    }
  }catch{
    showToast('Connection error. Please try again.','error');
    btn.classList.remove('loading');btn.disabled=false;
  }
});

// ── Google ──
document.getElementById('google-signin').addEventListener('click',function(){
  this.disabled=true;
  this.innerHTML='<span style="width:18px;height:18px;border:2px solid rgba(26,21,16,0.2);border-top-color:var(--ink);border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;"></span> Connecting…';
  setTimeout(()=>window.location.href='/auth/google',800);
});

// Email domain validation on blur
const signinEmailInput = document.querySelector('#signin-form input[name="email"]');
if(signinEmailInput){
  signinEmailInput.addEventListener('blur', function(){
    const email = this.value.trim().toLowerCase();
    const emailField = this.closest('.field');
    const emailErrorDiv = document.getElementById('email-error');
    
    if(!email){
      emailField.classList.remove('has-error');
      emailErrorDiv.textContent = '';
      return;
    }
    
    const emailDomain = email.split('@')[1];
    const allowedDomains = ['gmail.com', 'company.com'];
    
    if(!emailDomain || !allowedDomains.includes(emailDomain)){
      const errorMsg = `Email domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`;
      emailField.classList.add('has-error');
      emailErrorDiv.textContent = errorMsg;
    } else {
      emailField.classList.remove('has-error');
      emailErrorDiv.textContent = '';
    }
  });
}

const forgotModal=document.getElementById('forgot-password-modal');
const forgotLink=document.getElementById('forgot-password-link');
const forgotClose=document.getElementById('forgot-password-close');
const forgotForm=document.getElementById('forgot-password-form');
const forgotNewPassword=document.getElementById('forgot-new-password');
const forgotConfirmPassword=document.getElementById('forgot-confirm-password');
const forgotMatchMsg=document.getElementById('fp-match-msg');

function updateForgotMatchState(){
  if(!forgotNewPassword||!forgotConfirmPassword||!forgotMatchMsg) return;
  const a=forgotNewPassword.value;
  const b=forgotConfirmPassword.value;
  if(!a&&!b){
    forgotMatchMsg.textContent='';
    forgotMatchMsg.classList.remove('ok','err');
    return;
  }
  if(a===b){
    forgotMatchMsg.textContent='Passwords match';
    forgotMatchMsg.classList.add('ok');
    forgotMatchMsg.classList.remove('err');
  }else{
    forgotMatchMsg.textContent='Passwords do not match';
    forgotMatchMsg.classList.add('err');
    forgotMatchMsg.classList.remove('ok');
  }
}

if(forgotLink&&forgotModal){
  forgotLink.addEventListener('click',function(e){
    e.preventDefault();
    const signinEmail=document.querySelector('#signin-form input[name="email"]');
    const forgotEmail=document.getElementById('forgot-email');
    if(signinEmail&&forgotEmail&&signinEmail.value) forgotEmail.value=signinEmail.value;
    forgotModal.classList.add('active');
  });
}
if(forgotClose&&forgotModal){
  forgotClose.addEventListener('click',()=>forgotModal.classList.remove('active'));
  forgotModal.addEventListener('click',e=>{if(e.target===forgotModal)forgotModal.classList.remove('active');});
}
if(forgotNewPassword) forgotNewPassword.addEventListener('input',updateForgotMatchState);
if(forgotConfirmPassword) forgotConfirmPassword.addEventListener('input',updateForgotMatchState);
if(forgotForm){
  forgotForm.addEventListener('submit',async function(e){
    e.preventDefault();
    const btn=document.getElementById('forgot-password-btn');
    const data=Object.fromEntries(new FormData(this));
    if(data.new_password!==data.confirm_password){
      showToast('Passwords do not match.','error');
      return;
    }
    if(!isPasswordValid(data.new_password)){
      showToast('Password must be 8-15 chars with upper/lowercase, number, and special character.','error');
      return;
    }
    btn.classList.add('loading');btn.disabled=true;
    try{
      const res=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await res.json();
      if(result.success){
        showToast(result.message||'Password reset successful. Please sign in.');
        forgotModal.classList.remove('active');
        this.reset();
        updateForgotMatchState();
      }else{
        showToast(result.message||'Unable to reset password.','error');
      }
    }catch{
      showToast('Connection error. Please try again.','error');
    }finally{
      btn.classList.remove('loading');btn.disabled=false;
    }
  });
}

// ======================================================
// ===== LIVE TRADING TERMINAL ENGINE ==================
// ======================================================

// Pair configs
const PAIRS = {
  EURUSD: { base:1.17000, pip:0.0001, dec:5, label:'EUR / USD · SPOT', vol:'2.4M' },
  XAUUSD: { base:4939.19, pip:0.10,   dec:2, label:'XAU / USD · SPOT', vol:'840K' },
  BTCUSD: { base:112228,  pip:1,       dec:0, label:'BTC / USD · SPOT', vol:'320K' },
};

let activePair = 'XAUUSD';
let currentPrice = PAIRS.XAUUSD.base;
let candles = [];   // {o,h,l,c}
let candleTick = 0;

// Generate initial candle history
function initCandles(pair){
  const cfg = PAIRS[pair];
  currentPrice = cfg.base + (Math.random()-0.5)*cfg.pip*20;
  candles = [];
  let p = currentPrice;
  for(let i=0;i<40;i++){
    const o = p;
    const move = (Math.random()-0.48)*cfg.pip*30;
    const c = o + move;
    const h = Math.max(o,c) + Math.random()*cfg.pip*8;
    const l = Math.min(o,c) - Math.random()*cfg.pip*8;
    candles.push({o,h,l,c});
    p = c;
  }
  currentPrice = p;
  candleTick = 0;
}

// Canvas chart
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas(){
  const w = canvas.parentElement.clientWidth - 16;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = 110 * window.devicePixelRatio;
  canvas.style.width = w+'px';
  canvas.style.height = '110px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function drawChart(){
  resizeCanvas();
  const W = canvas.clientWidth;
  const H = 110;
  const RIGHT_GUTTER = 44;
  const plotW = Math.max(10, W - RIGHT_GUTTER);
  ctx.clearRect(0,0,W,H);

  const visible = candles.slice(-36);
  const prices = visible.flatMap(c=>[c.h,c.l]);
  const hi = Math.max(...prices);
  const lo = Math.min(...prices);
  const range = hi-lo || 1;
  const pad = range*0.1;

  const toY = v => H - ((v-(lo-pad))/((hi+pad)-(lo-pad)))*H;

  // Grid lines
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(let i=1;i<4;i++){
    const y=Math.round(H*i/4)+0.5;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }

  // Y labels
  const labels=document.getElementById('chartYLabels');
  labels.innerHTML='';
  for(let i=0;i<4;i++){
    const val=hi+pad - ((hi+pad-(lo-pad))*(i/3));
    const d=document.createElement('span');
    d.textContent=val.toFixed(PAIRS[activePair].dec>2?4:2);
    labels.appendChild(d);
  }

  const cw = (plotW-4)/visible.length;

  visible.forEach((c,i)=>{
    const x = i*cw + cw/2;
    const isUp = c.c >= c.o;
    const col = isUp ? '#4ade80' : '#f87171';
    const bodyTop = toY(Math.max(c.o,c.c));
    const bodyBot = toY(Math.min(c.o,c.c));
    const bodyH = Math.max(bodyBot-bodyTop, 1);
    const wickTop = toY(c.h);
    const wickBot = toY(c.l);

    // Wick
    ctx.strokeStyle=col;ctx.lineWidth=0.8;ctx.globalAlpha=0.7;
    ctx.beginPath();ctx.moveTo(x,wickTop);ctx.lineTo(x,wickBot);ctx.stroke();
    ctx.globalAlpha=1;

    // Body
    ctx.fillStyle=isUp?'rgba(74,222,128,0.85)':'rgba(248,113,113,0.85)';
    const bx=x-cw*0.3;
    ctx.fillRect(bx,bodyTop,cw*0.6,bodyH);
  });

  // Current price line
  const py=toY(currentPrice);
  ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1;ctx.setLineDash([3,4]);
  ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(plotW,py);ctx.stroke();
  ctx.setLineDash([]);

  // Price tag
  const cfg=PAIRS[activePair];
  ctx.fillStyle='rgba(255,255,255,0.12)';
  const tag=currentPrice.toFixed(cfg.dec>2?4:2);
  const tw=ctx.measureText(tag).width+10;
  ctx.fillRect(W-tw-2,py-8,tw,16);
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='8px Cabinet Grotesk,sans-serif';
  ctx.fillText(tag,W-tw+2,py+3);
}

// Order book
function renderBook(){
  const cfg=PAIRS[activePair];
  const rows=document.getElementById('bookRows');
  rows.innerHTML='';
  const sells=[];const buys=[];
  for(let i=0;i<4;i++){
    sells.push({p:currentPrice+(i+1)*cfg.pip*2,sz:(Math.random()*3+0.5).toFixed(2)});
    buys.push({p:currentPrice-(i+1)*cfg.pip*2,sz:(Math.random()*3+0.5).toFixed(2)});
  }
  const maxSz=4;
  sells.reverse().forEach(r=>{
    const d=document.createElement('div');
    d.className='brow sell';
    const pct=(parseFloat(r.sz)/maxSz*100).toFixed(0);
    const total=(parseFloat(r.sz)*r.p).toFixed(0);
    d.innerHTML=`<div class="brow-fill" style="width:${pct}%"></div><span>${r.p.toFixed(cfg.dec>2?4:2)}</span><span>${r.sz}</span><span>${total}</span>`;
    rows.appendChild(d);
  });
  buys.forEach(r=>{
    const d=document.createElement('div');
    d.className='brow buy';
    const pct=(parseFloat(r.sz)/maxSz*100).toFixed(0);
    const total=(parseFloat(r.sz)*r.p).toFixed(0);
    d.innerHTML=`<div class="brow-fill" style="width:${pct}%"></div><span>${r.p.toFixed(cfg.dec>2?4:2)}</span><span>${r.sz}</span><span>${total}</span>`;
    rows.appendChild(d);
  });
}

// Trade feed
const MAX_FEED=6;
function addFeedRow(price,up){
  const cfg=PAIRS[activePair];
  const container=document.getElementById('feedRows');
  const size=(Math.random()*4+0.1).toFixed(2);
  const side=up?'buy':'sell';
  const now=new Date();
  const ts=String(now.getUTCHours()).padStart(2,'0')+':'+String(now.getUTCMinutes()).padStart(2,'0')+':'+String(now.getUTCSeconds()).padStart(2,'0');
  const row=document.createElement('div');
  row.className='frow';
  row.innerHTML=`<span class="frow-side ${side}">${side.toUpperCase()}</span><span class="frow-price">${price.toFixed(cfg.dec>2?4:2)}</span><span class="frow-size">${size}</span><span class="frow-time">${ts}</span>`;
  container.insertBefore(row,container.firstChild);
  while(container.children.length>MAX_FEED) container.removeChild(container.lastChild);
}

// Price tick
let prevPrice=currentPrice;
function tick(){
  const cfg=PAIRS[activePair];
  const move=(Math.random()-0.495)*cfg.pip*8;
  currentPrice+=move;
  const up=currentPrice>=prevPrice;

  // Flash price
  const el=document.getElementById('mainPrice');
  el.textContent=currentPrice.toFixed(cfg.dec>2?5:2);
  el.classList.remove('flash-up','flash-down');
  void el.offsetWidth;
  el.classList.add(up?'flash-up':'flash-down');
  setTimeout(()=>el.classList.remove('flash-up','flash-down'),300);

  // Change badge
  const pctChange=((currentPrice-cfg.base)/cfg.base*100);
  const badge=document.getElementById('changeBadge');
  badge.textContent=(pctChange>=0?'+':'')+pctChange.toFixed(2)+'%';
  badge.className='price-badge '+(pctChange>=0?'up':'down');

  // Bid/Ask
  const half=cfg.pip*0.7;
  document.getElementById('bidVal').textContent=(currentPrice-half).toFixed(cfg.dec>2?5:2);
  document.getElementById('askVal').textContent=(currentPrice+half).toFixed(cfg.dec>2?5:2);
  document.getElementById('spreadVal').textContent=(cfg.pip*14000).toFixed(1);

  // Update last candle
  candleTick++;
  if(candleTick>8){
    candles.push({o:prevPrice,h:Math.max(prevPrice,currentPrice)+Math.random()*cfg.pip*3,l:Math.min(prevPrice,currentPrice)-Math.random()*cfg.pip*3,c:currentPrice});
    if(candles.length>60) candles.shift();
    candleTick=0;
  } else {
    const last=candles[candles.length-1];
    last.c=currentPrice;
    last.h=Math.max(last.h,currentPrice);
    last.l=Math.min(last.l,currentPrice);
  }

  drawChart();
  if(Math.random()<0.4) addFeedRow(currentPrice,up);
  if(Math.random()<0.15) renderBook();

  prevPrice=currentPrice;
}

// Pair switch
function switchPair(btn,pair){
  document.querySelectorAll('.pair-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  activePair=pair;
  const cfg=PAIRS[pair];
  document.getElementById('pairLabel').textContent=cfg.label;
  document.getElementById('volVal').textContent=cfg.vol;
  document.getElementById('feedRows').innerHTML='';
  initCandles(pair);
  drawChart();
  renderBook();
}

// Init
initCandles('XAUUSD');
drawChart();
renderBook();
addFeedRow(currentPrice,true);
setInterval(tick,600);
window.addEventListener('resize',drawChart);
