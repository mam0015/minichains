const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;
const params = new URLSearchParams(location.search);
const orderId = params.get('order') || localStorage.getItem('mini-last-order-id');
const isDemo = params.get('demo') === '1';
const ORDERS_KEY = 'mini-orders-v1';
const SPINS_KEY = 'mini-spins-v1';
const PROMOS_KEY = 'mini-issued-promos-v1';

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const orders = read(ORDERS_KEY, []);
let order = orders.find(o => o.id === orderId) || null;

// Preview fallback only, used when success.html is opened directly.
if (!order) {
  order = {
    id: 'MINI-PREVIEW',
    demo: true,
    createdAt: new Date().toISOString(),
    items: [
      {id:'KEY-01', qty:1, price:4},
      {id:'KEY-05', qty:1, price:3},
      {id:'KEY-06', qty:1, price:3.5}
    ],
    subtotal: 10.5,
    discount: 0,
    total: 10.5
  };
}

const demoWarning = document.querySelector('#demoWarning');
if (isDemo || order.demo) demoWarning.hidden = false;
document.querySelector('#orderRef').textContent = order.id;
document.querySelector('#orderTotal').textContent = money(order.total);

const detailRows = order.items.map(row => ({...row, product: products.find(p => p.id === row.id)})).filter(x => x.product);
document.querySelector('#successItems').innerHTML = detailRows.map(({product:p, qty, price}) => `
  <article class="success-item">
    <img src="${p.image}" onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'" alt="${p.name}">
    <div><h3>${p.name}</h3><p>MODEL ${p.id} · Qty ${qty}</p></div>
    <strong>${money((price ?? p.price) * qty)}</strong>
  </article>`).join('');

const breakdown = [];
breakdown.push(`<div><span>Subtotal</span><span>${money(order.subtotal)}</span></div>`);
if (order.discount > 0) breakdown.push(`<div><span>Discount${order.promoCode ? ` · ${order.promoCode}` : ''}</span><span>−${money(order.discount)}</span></div>`);
breakdown.push(`<div><span>Paid total</span><span>${money(order.total)}</span></div>`);
document.querySelector('#orderBreakdown').innerHTML = breakdown.join('');

const itemQty = detailRows.reduce((sum, r) => sum + Number(r.qty || 0), 0);
const wheelSection = document.querySelector('#wheelSection');
const spinBtn = document.querySelector('#spinBtn');
const wheel = document.querySelector('#prizeWheel');
const wheelCenterText = document.querySelector('#wheelCenterText');
const spinStatus = document.querySelector('#spinStatus');
const result = document.querySelector('#prizeResult');

const segments = [
  {key:'empty-a', label:'No prize', type:'empty', weight:25, start:0, end:25},
  {key:'off-5', label:'5% off', type:'discount', percent:5, weight:12, start:25, end:37},
  {key:'empty-b', label:'No prize', type:'empty', weight:20, start:37, end:57},
  {key:'free', label:'Free item', type:'free', weight:10, start:57, end:67},
  {key:'empty-c', label:'No prize', type:'empty', weight:20, start:67, end:87},
  {key:'off-10', label:'10% off', type:'discount', percent:10, weight:8, start:87, end:95},
  {key:'off-20', label:'20% off', type:'discount', percent:20, weight:5, start:95, end:100}
];

function cryptoFloat(){
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
function randomCode(percent){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a=new Uint32Array(6); crypto.getRandomValues(a);
  const tail=[...a].map(n=>chars[n%chars.length]).join('');
  return `MINI${percent}-${tail}`;
}
function randomProduct(){
  const a=new Uint32Array(1); crypto.getRandomValues(a);
  return products[a[0] % products.length];
}
function chooseSegment(){
  const n = cryptoFloat() * 100;
  return segments.find(s => n >= s.start && n < s.end) || segments[0];
}
function targetRotation(seg){
  const centerPercent = (seg.start + seg.end) / 2;
  const centerDeg = centerPercent * 3.6;
  // conic-gradient starts at 12 o'clock; pointer is also 12 o'clock.
  return 360 * 7 + (360 - centerDeg);
}
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),1600)}

function saveSpin(spin){
  const spins=read(SPINS_KEY,[]).filter(s=>s.orderId!==order.id);spins.push(spin);write(SPINS_KEY,spins);
}
function getSpin(){return read(SPINS_KEY,[]).find(s=>s.orderId===order.id)}
function issuePromo(percent, orderId){
  const code=randomCode(percent);
  const promos=read(PROMOS_KEY,[]);promos.push({code,percent,orderId,used:false,createdAt:new Date().toISOString()});write(PROMOS_KEY,promos);return code;
}
function showResult(spin){
  result.hidden=false;
  const title=document.querySelector('#resultTitle'), text=document.querySelector('#resultText');
  const codeBox=document.querySelector('#promoCodeBox'), freeBox=document.querySelector('#freeItemBox');
  codeBox.hidden=true;freeBox.hidden=true;
  if(spin.type==='discount'){
    title.textContent=`You won ${spin.percent}% off.`;
    text.textContent='Your one-time code is ready for a future mini order.';
    document.querySelector('#promoCode').textContent=spin.code;codeBox.hidden=false;wheelCenterText.textContent=`${spin.percent}% OFF`;
  }else if(spin.type==='free'){
    const p=products.find(x=>x.id===spin.freeProductId) || products[0];
    title.textContent='You won a free keychain.';
    text.textContent=`Your random free item is ${p.name}. Show this result to us when you collect your order.`;
    const im=document.querySelector('#freeItemImage');im.src=p.image;im.onerror=()=>{im.onerror=null;im.src=p.fallback||'assets/images/smiley.svg'};
    document.querySelector('#freeItemName').textContent=p.name;freeBox.hidden=false;wheelCenterText.textContent='FREE!';
  }else{
    title.textContent='No prize this time.';
    text.textContent='Your order is still confirmed. There are three no-prize sections so the wheel does not hand out prizes to half the school.';
    wheelCenterText.textContent='NEXT TIME';
  }
  spinBtn.disabled=true;spinBtn.textContent='Spin already used';spinStatus.textContent='This paid order has already used its one spin.';
}

if(itemQty < 3){
  wheelSection.classList.add('locked-wheel');
  document.querySelector('#wheelTitle').textContent='Spin not unlocked on this order.';
  document.querySelector('#wheelIntro').textContent=`This order has ${itemQty} item${itemQty===1?'':'s'}. Buy 3 or more items in one paid order to unlock one spin.`;
}else{
  const existing=getSpin();
  if(existing){
    const seg=segments.find(s=>s.key===existing.segmentKey)||segments[0];
    wheel.style.transform=`rotate(${targetRotation(seg)}deg)`;
    showResult(existing);
  }
}

spinBtn.addEventListener('click',()=>{
  if(itemQty<3 || getSpin()) return;
  spinBtn.disabled=true;spinBtn.textContent='Spinning…';spinStatus.textContent='Random draw in progress…';
  const seg=chooseSegment();
  const spin={orderId:order.id,segmentKey:seg.key,type:seg.type,createdAt:new Date().toISOString()};
  if(seg.type==='discount'){spin.percent=seg.percent;spin.code=issuePromo(seg.percent,order.id)}
  if(seg.type==='free'){spin.freeProductId=randomProduct().id}
  saveSpin(spin);
  wheel.style.transform=`rotate(${targetRotation(seg)}deg)`;
  setTimeout(()=>{showResult(spin);result.scrollIntoView({behavior:'smooth',block:'center'})},5350);
});

document.querySelector('#copyCode').addEventListener('click',async()=>{const code=document.querySelector('#promoCode').textContent;if(!code)return;try{await navigator.clipboard.writeText(code);toast('Code copied')}catch{toast(code)}});
