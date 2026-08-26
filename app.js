const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v).toFixed(2)}`;
const grid = document.querySelector('#productGrid');
const count = document.querySelector('#productCount');
let searchTerm = '', sortMode = 'default', cart = JSON.parse(localStorage.getItem('mini-keychain-cart') || '[]'), quickProduct = null;

function productCard(p){
  const tag = p.tag ? `<span class="tag">${p.tag}</span>` : '';
  const colors = p.colors.map(c=>`<span class="swatch ${c}" title="${c}"></span>`).join('');
  return `<article class="product-card">
    <button class="product-image" data-view="${p.id}" aria-label="View ${p.name}"><img src="${p.image}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer" style="object-position:${p.imagePosition||'center'}" onerror="this.onerror=null;this.src='${p.fallback||'assets/images/smiley.svg'}'">${tag}<span class="wish">♡</span></button>
    <div class="product-info">
      <div class="product-meta"><div><h3 class="product-name">${p.name}</h3><div class="model">MODEL ${p.id}</div></div><span class="price">${money(p.price)}</span></div>
      <div class="spec-row"><span>${p.size}</span><span>≈ ${p.grams} g PLA</span><span>${p.printTime}</span></div>
      <div class="colour-row"><div class="swatches">${colors}</div><span class="stock">Small batch</span></div><div class="model-credit">Photo/model: <a href="${p.source}" target="_blank" rel="noopener">${p.credit}</a> · MakerWorld</div>
      <div class="product-actions"><button class="add-btn" data-add="${p.id}">Add to bag</button><button class="view-btn" data-view="${p.id}">↗</button></div>
    </div>
  </article>`;
}
function renderProducts(){
  let rows = products.filter(p => `${p.name} ${p.id} ${p.size}`.toLowerCase().includes(searchTerm));
  if(sortMode==='price-low') rows.sort((a,b)=>a.price-b.price);
  if(sortMode==='smallest') rows.sort((a,b)=>a.grams-b.grams);
  grid.innerHTML = rows.map(productCard).join('') || `<div style="grid-column:1/-1;padding:60px;text-align:center">No keychains found.</div>`;
  count.textContent = `${rows.length} design${rows.length===1?'':'s'}`;
}

document.querySelectorAll('[data-sort]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-sort]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');sortMode=btn.dataset.sort;renderProducts()}));

grid.addEventListener('click',e=>{const add=e.target.closest('[data-add]'),view=e.target.closest('[data-view]');if(add)addToCart(add.dataset.add);else if(view)openQuick(view.dataset.view)});
function addToCart(id){const p=products.find(x=>x.id===id);if(!p)return;const row=cart.find(x=>x.id===id);row?row.qty++:cart.push({id,qty:1});saveCart();renderCart();toastMsg(`${p.name} added`)}
function removeFromCart(id){cart=cart.filter(x=>x.id!==id);saveCart();renderCart()}
function saveCart(){localStorage.setItem('mini-keychain-cart',JSON.stringify(cart))}
function renderCart(){const rows=cart.map(r=>({...r,p:products.find(p=>p.id===r.id)})).filter(r=>r.p);const qty=rows.reduce((s,r)=>s+r.qty,0);document.querySelector('#cartCount').textContent=qty;document.querySelector('#cartEmpty').classList.toggle('show',!qty);document.querySelector('#cartSummary').style.display=qty?'block':'none';document.querySelector('#cartItems').innerHTML=rows.map(({p,qty})=>`<div class="cart-item"><img src="${p.image}" alt=""><div><h4>${p.name}</h4><p>${money(p.price)} · Qty ${qty}</p></div><button data-remove="${p.id}">×</button></div>`).join('');document.querySelector('#cartSubtotal').textContent=money(rows.reduce((s,r)=>s+r.p.price*r.qty,0))}
document.querySelector('#cartItems').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b)removeFromCart(b.dataset.remove)});
const drawer=document.querySelector('#cartDrawer'),overlay=document.querySelector('#overlay');
function openCart(){drawer.classList.add('open');overlay.classList.add('show');document.body.classList.add('locked')}
function closeCart(){drawer.classList.remove('open');overlay.classList.remove('show');document.body.classList.remove('locked')}
document.querySelector('#cartToggle').addEventListener('click',openCart);document.querySelector('#cartClose').addEventListener('click',closeCart);overlay.addEventListener('click',closeCart);

document.querySelector('#checkoutBtn').addEventListener('click',()=>{const link=cart.length===1?products.find(p=>p.id===cart[0].id)?.paymentLink:'';if(link)location.href=link;else toastMsg('Payment link is not connected yet')});

const quick=document.querySelector('#quickView');
function openQuick(id){const p=products.find(x=>x.id===id);if(!p)return;quickProduct=p;const qi=document.querySelector('#quickImage');qi.src=p.image;qi.referrerPolicy='no-referrer';qi.style.objectPosition=p.imagePosition||'center';qi.onerror=()=>{qi.onerror=null;qi.src=p.fallback||'assets/images/smiley.svg'};document.querySelector('#quickName').textContent=p.name;document.querySelector('#quickModel').textContent=`MODEL ${p.id}`;document.querySelector('#quickPrice').textContent=money(p.price);document.querySelector('#quickSize').textContent=p.size;document.querySelector('#quickWeight').textContent=`≈ ${p.grams} g PLA`;document.querySelector('#quickTime').textContent=p.printTime;document.querySelector('#quickDesc').textContent=p.desc;document.querySelector('#quickSwatches').innerHTML=p.colors.map(c=>`<span class="swatch ${c}"></span>`).join('');quick.showModal()}
document.querySelector('#quickClose').addEventListener('click',()=>quick.close());document.querySelector('#quickAdd').addEventListener('click',()=>{if(quickProduct){addToCart(quickProduct.id);quick.close();openCart()}});

const searchPanel=document.querySelector('#searchPanel'),search=document.querySelector('#siteSearch');
document.querySelector('#searchToggle').addEventListener('click',()=>{searchPanel.classList.add('open');setTimeout(()=>search.focus(),100)});document.querySelector('#searchClose').addEventListener('click',()=>searchPanel.classList.remove('open'));search.addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();renderProducts();if(searchTerm)location.hash='shop'});
const mobile=document.querySelector('#mobileNav');document.querySelector('#menuToggle').addEventListener('click',()=>mobile.classList.toggle('open'));mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mobile.classList.remove('open')));
function toastMsg(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__miniToast);window.__miniToast=setTimeout(()=>t.classList.remove('show'),1700)}

// hero slider
const slides=[...document.querySelectorAll('.hero-slide')], dots=[...document.querySelectorAll('[data-slide-to]')];let slide=0,timer;
function showSlide(n){slide=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===slide));dots.forEach((d,i)=>d.classList.toggle('active',i===slide));restartSlider()}
function restartSlider(){clearInterval(timer);timer=setInterval(()=>showSlide(slide+1),5500)}
document.querySelector('#nextSlide').addEventListener('click',()=>showSlide(slide+1));document.querySelector('#prevSlide').addEventListener('click',()=>showSlide(slide-1));dots.forEach(d=>d.addEventListener('click',()=>showSlide(+d.dataset.slideTo)));

renderProducts();renderCart();restartSlider();
