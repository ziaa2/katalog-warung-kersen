const CFG = window.WARUNG_CONFIG || {};
const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
let products = [], cart = new Map(), activeCategory = "Semua";

async function loadProducts(){
  try{
    if(CFG.API_BASE){
      const r = await fetch(`${CFG.API_BASE.replace(/\/$/,"")}/products`);
      if(!r.ok) throw new Error("API request failed");
      products = (await r.json()).filter(p=>p.is_available!==false);
    } else {
      const r = await fetch("data/products.json?"+Date.now());
      products = await r.json();
    }
  }catch(e){ console.error(e); products=[]; }
  render();
}
function render(){
  const cats=["Semua",...new Set(products.map(p=>p.category).filter(Boolean))];
  $("#categories").innerHTML=cats.map(c=>`<button class="chip ${c===activeCategory?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  $("#categories").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;render()});
  const q=$("#search").value.trim().toLowerCase();
  const shown=products.filter(p=>(activeCategory==="Semua"||p.category===activeCategory)&&(`${p.name} ${p.brand||""}`.toLowerCase().includes(q)));
  $("#productGrid").innerHTML=shown.map(card).join("");
  $("#empty").classList.toggle("hidden",shown.length!==0);
  $("#productGrid").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>add(b.dataset.add));
  $("#productGrid").querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>change(b.dataset.minus,-1));
  $("#productGrid").querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>change(b.dataset.plus,1));
  updateCart();
}
function card(p){
  const qty=cart.get(p.id)||0, disabled=p.is_available===false;
  return `<article class="product-card">
    <div class="product-image">${p.image?`<img src="${esc(p.image)}" alt="">`:`<span>${initials(p.name)}</span>`}</div>
    <div class="product-body"><div class="product-meta">${esc(p.brand||p.category||"")}</div><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong>
    <div class="stock">${disabled?"<i>Habis</i>":(p.stock_status==="low"?"<i>Stok hampir habis</i>":"<span>Tersedia</span>")}</div>
    ${disabled?`<button class="disabled full" disabled>Habis</button>`:`<div class="qty"><button data-minus="${p.id}">−</button><b>${qty}</b><button data-plus="${p.id}">+</button></div>`}
    </div></article>`;
}
function add(id){ const p=products.find(x=>x.id===id); if(!p)return; const n=cart.get(id)||0; if(!p.is_available) return; cart.set(id,n+1); render(); }
function change(id,d){ const p=products.find(x=>x.id===id), n=Math.max(0,(cart.get(id)||0)+d); if(!p)return; if(n===0)cart.delete(id); else cart.set(id,n); render(); }
function updateCart(){
  let count=0,total=0; cart.forEach((q,id)=>{const p=products.find(x=>x.id===id);if(p){count+=q;total+=q*Number(p.price)}});
  $("#cartBar").classList.toggle("hidden",count===0); $("#cartCount").textContent=`${count} barang`;$("#cartTotal").textContent=money(total);$("#dialogTotal").textContent=money(total);
  $("#cartItems").innerHTML=[...cart.entries()].map(([id,q])=>{const p=products.find(x=>x.id===id);return p?`<div class="cart-row"><div><b>${esc(p.name)}</b><small>${money(p.price)} × ${q}</small></div><div class="qty"><button data-cminus="${id}">−</button><b>${q}</b><button data-cplus="${id}">+</button></div></div>`:""}).join("");
  $("#cartItems").querySelectorAll("[data-cminus]").forEach(b=>b.onclick=()=>{change(b.dataset.cminus,-1);updateCart()});
  $("#cartItems").querySelectorAll("[data-cplus]").forEach(b=>b.onclick=()=>{change(b.dataset.cplus,1);updateCart()});
}
$("#search").oninput=render;
$("#openCart").onclick=()=>{updateCart();$("#cartDialog").showModal()};
$("#closeCart").onclick=()=>$("#cartDialog").close();
$("#waOrder").onclick=()=>{
  if(!cart.size)return;
  const name=$("#customerName").value.trim(),note=$("#customerNote").value.trim();
  let total=0, lines=[`Halo ${CFG.STORE_NAME||"Warung"} 👋`,``,`Saya mau pesan:`];
  cart.forEach((q,id)=>{const p=products.find(x=>x.id===id);if(p){total+=q*p.price;lines.push(`• ${p.name} × ${q} — ${money(q*p.price)}`)}});
  lines.push("",`Total sementara: ${money(total)}`,name?`Nama: ${name}`:"",note?`Catatan: ${note}`:"","",`Mohon konfirmasi ketersediaan dan total akhirnya.`);
  const url=`https://wa.me/${String(CFG.WHATSAPP_NUMBER||"").replace(/\D/g,"")}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
  window.open(url,"_blank");
};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function initials(s){return String(s||"W").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
const theme=localStorage.getItem("warung-theme")||"dark";document.documentElement.dataset.theme=theme;$("#themeBtn").onclick=()=>{const n=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=n;localStorage.setItem("warung-theme",n)};
if("serviceWorker"in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
loadProducts();
