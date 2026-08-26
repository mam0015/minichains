const products = window.MINI_PRODUCTS || [];
const grid = document.querySelector('#productGrid');
const productCount = document.querySelector('#productCount');
const filters = [...document.querySelectorAll('[data-filter]')];
const cartDrawer = document.querySelector('#cartDrawer');
const overlay = document.querySelector('#overlay');
const cartItemsEl = document.querySelector('#cartItems');
const cartEmpty = document.querySelector('#cartEmpty');
const cartSummary = document.querySelector('#cartSummary');
const cartCount = document.querySelector('#cartCount');
const cartSubtotal = document.querySelector('#cartSubtotal');
const quickView = document.querySelector('#quickView');
const toast = document.querySelector('#toast');
let currentFilter = 'all';
let searchTerm = '';
let quickProduct = null;
let cart = JSON.parse(localStorage.getItem('mini-cart') || '[]');

const money = value => `A$${Number(value).toFixed(2)}`;
const colorLabel = c => c.charAt(0).toUpperCase() + c.slice(1);

function productCard(p){
  const tag = p.tag ? `<span class="tag">${p.tag}</span>` : '';
  const swatches = p.colors.map(c=>`<span class="swatch ${c}" title="${colorLabel(c)}"></span>`).join('');
  return `<article class="product-card" data-type="${p.type}">
    <button class="product-image" data-view="${p.id}" aria-label="View ${p.name}"><img src="${p.image}" alt="${p.name}">${tag}<span class="wish" aria-hidden="true">♡</span></button>
    <div class="product-info">
      <div class="product-meta"><div><h3 class="product-name">${p.name}</h3><div class="model">MODEL ${p.id}</div></div><span class="price">${money(p.price)}</span></div>
      <div class="colour-row"><div class="swatches">${swatches}</div><span class="stock">In stock</span></div>
      <div class="product-actions"><button class="add-btn" data-add="${p.id}">Add to bag</button><button class="view-btn" data-view="${p.id}" aria-label="Quick view">↗</button></div>
    </div>
  </article>`;
}

function renderProducts(){
  const filtered = products.filter(p => (currentFilter === 'all' || p.type === currentFilter) && (`${p.name} ${p.id} ${p.type}`).toLowerCase().includes(searchTerm));
  grid.innerHTML = filtered.map(productCard).join('');
  productCount.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
  if(!filtered.length) grid.innerHTML = `<div style="grid-column:1/-1;padding:70px 0;text-align:center;color:#766b71"><h3>No products found.</h3><p>Try a different search or category.</p></div>`;
}

function setFilter(filter){
  currentFilter = filter;
  filters.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderProducts();
}

function addToCart(id){
  const p = products.find(x=>x.id===id); if(!p) return;
  const existing = cart.find(x=>x.id===id);
  if(existing) existing.qty += 1; else cart.push({id:p.id,qty:1});
  saveCart(); renderCart(); showToast(`${p.name} added to bag`);
}
function removeFromCart(id){cart = cart.filter(x=>x.id!==id); saveCart(); renderCart();}
function saveCart(){localStorage.setItem('mini-cart', JSON.stringify(cart));}
function renderCart(){
  const enriched = cart.map(row=>({...row, product:products.find(p=>p.id===row.id)})).filter(x=>x.product);
  const qty = enriched.reduce((n,x)=>n+x.qty,0); cartCount.textContent = qty;
  cartEmpty.classList.toggle('show', qty===0); cartSummary.style.display = qty ? 'block':'none';
  cartItemsEl.innerHTML = enriched.map(({product:p,qty})=>`<div class="cart-item"><img src="${p.image}" alt=""><div><h4>${p.name}</h4><p>${money(p.price)} · Qty ${qty}</p></div><button data-remove="${p.id}" aria-label="Remove ${p.name}">×</button></div>`).join('');
  cartSubtotal.textContent = money(enriched.reduce((sum,x)=>sum+(x.product.price*x.qty),0));
}
function openCart(){cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden','false'); overlay.classList.add('show'); document.body.classList.add('locked');}
function closeCart(){cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden','true'); overlay.classList.remove('show'); document.body.classList.remove('locked');}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>toast.classList.remove('show'),1800)}

function openQuick(id){
  const p = products.find(x=>x.id===id); if(!p) return; quickProduct=p;
  document.querySelector('#quickImage').src=p.image; document.querySelector('#quickImage').alt=p.name;
  document.querySelector('#quickModel').textContent=`MODEL ${p.id}`; document.querySelector('#quickName').textContent=p.name;
  document.querySelector('#quickPrice').textContent=money(p.price); document.querySelector('#quickDesc').textContent=p.desc;
  document.querySelector('#quickSwatches').innerHTML=p.colors.map(c=>`<span class="swatch ${c}" title="${colorLabel(c)}"></span>`).join('');
  quickView.showModal();
}

filters.forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.filter)));
document.querySelectorAll('[data-filter-link]').forEach(link=>link.addEventListener('click',()=>setFilter(link.dataset.filterLink)));
grid.addEventListener('click',e=>{const add=e.target.closest('[data-add]');const view=e.target.closest('[data-view]');if(add)addToCart(add.dataset.add);else if(view)openQuick(view.dataset.view)});
cartItemsEl.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b)removeFromCart(b.dataset.remove)});
document.querySelector('#cartToggle').addEventListener('click',openCart);document.querySelector('#cartClose').addEventListener('click',closeCart);overlay.addEventListener('click',closeCart);
document.querySelector('#quickClose').addEventListener('click',()=>quickView.close());document.querySelector('#quickAdd').addEventListener('click',()=>{if(quickProduct){addToCart(quickProduct.id);quickView.close();openCart()}});

const searchPanel=document.querySelector('#searchPanel'), searchInput=document.querySelector('#siteSearch');
document.querySelector('#searchToggle').addEventListener('click',()=>{searchPanel.classList.add('open');searchPanel.setAttribute('aria-hidden','false');setTimeout(()=>searchInput.focus(),100)});
document.querySelector('#searchClose').addEventListener('click',()=>{searchPanel.classList.remove('open');searchPanel.setAttribute('aria-hidden','true')});
searchInput.addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();renderProducts(); if(searchTerm) location.hash='shop'});

const mobileNav=document.querySelector('#mobileNav');document.querySelector('#menuToggle').addEventListener('click',()=>mobileNav.classList.toggle('open'));mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mobileNav.classList.remove('open')));

document.querySelector('#checkoutBtn').addEventListener('click',()=>{
  // Static GitHub Pages cannot safely create a dynamic Stripe checkout session by itself.
  // Add a real cart checkout URL here, or use per-product paymentLink values in products.js.
  const direct = cart.length === 1 ? products.find(p=>p.id===cart[0].id)?.paymentLink : '';
  if(direct) window.location.href=direct; else showToast('Add your Stripe/Square checkout link in products.js');
});
document.querySelector('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();showToast('Thanks — form ready to connect');e.target.reset()});
document.querySelector('#year').textContent=new Date().getFullYear();

renderProducts(); renderCart();
