const CFG=window.WARUNG_CONFIG||{};
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
let products=[], editing=null, stream=null;

function localMode(){return !(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY)}
async function load(){
  if(localMode()){
    products=JSON.parse(localStorage.getItem("warung-products")||"null") || await (await fetch("../data/products.json")).json();
    localStorage.setItem("warung-products",JSON.stringify(products));
    return;
  }
  const r=await fetch(`${CFG.SUPABASE_URL}/rest/v1/products?select=*&order=name`,{headers:{apikey:CFG.SUPABASE_ANON_KEY,Authorization:`Bearer ${CFG.SUPABASE_ANON_KEY}`}});
  if(!r.ok)throw Error("Gagal memuat produk"); products=await r.json();
}
function saveLocal(){localStorage.setItem("warung-products",JSON.stringify(products))}
function showDash(){ $("#loginView").classList.add("hidden");$("#dashboardView").classList.remove("hidden");$("#logoutBtn").classList.remove("hidden");renderList(); }
async function init(){try{await load();showDash()}catch(e){console.error(e);}}
$("#loginBtn").onclick=async()=>{
  const email=$("#email").value.trim(),pass=$("#password").value;
  if(localMode()){ if(email&&pass){sessionStorage.setItem("warung-admin","1");showDash()} else $("#loginMsg").textContent="Isi email dan password."; return; }
  try{
    const r=await fetch(`${CFG.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:CFG.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pass})});
    if(!r.ok)throw Error("Email/password salah");
    const data=await r.json(); sessionStorage.setItem("warung-session",JSON.stringify(data)); showDash();
  }catch(e){$("#loginMsg").textContent=e.message}
};
$("#logoutBtn").onclick=()=>{sessionStorage.clear();location.reload()};
function renderList(){
  $("#statProducts").textContent=products.length;$("#statAvailable").textContent=products.filter(p=>Number(p.stock)>0).length;$("#statSoldOut").textContent=products.filter(p=>Number(p.stock)<=0).length;
  const q=$("#adminSearch").value.toLowerCase(); const list=products.filter(p=>`${p.name} ${p.brand||""} ${p.barcode||""}`.toLowerCase().includes(q));
  $("#adminList").innerHTML=list.map(p=>`<div class="admin-row"><div class="mini-image">${p.image?`<img src="${esc(p.image)}">`:initials(p.name)}</div><div class="row-main"><b>${esc(p.name)}</b><small>${esc(p.brand||"")} · ${esc(p.category||"Tanpa kategori")} · ${p.barcode?esc(p.barcode):"tanpa barcode"}</small></div><div class="row-price"><b>${money(p.price)}</b><small>Stok ${p.stock}</small></div><button class="ghost" data-edit="${p.id}">Edit</button><button class="danger" data-del="${p.id}">Hapus</button></div>`).join("");
  $("#adminList").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openForm(products.find(p=>p.id===b.dataset.edit)));
  $("#adminList").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>removeProduct(b.dataset.del));
}
async function persist(){
  if(localMode()){saveLocal();return}
  const s=JSON.parse(sessionStorage.getItem("warung-session")||"null"); if(!s?.access_token)throw Error("Sesi admin tidak ditemukan");
  // For a production deployment, protect the table with RLS and use the authenticated user's JWT.
  const p=editing||{}; const method=editing?"PATCH":"POST"; const url=editing?`${CFG.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`:`${CFG.SUPABASE_URL}/rest/v1/products`;
  const body={barcode:p.barcode||null,name:p.name,brand:p.brand||null,price:Number(p.price),stock:Number(p.stock),category:p.category||null,image:p.image||null,is_available:Number(p.stock)>0};
  const r=await fetch(url,{method,headers:{apikey:CFG.SUPABASE_ANON_KEY,Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(body)});if(!r.ok)throw Error("Database gagal menyimpan"); if(editing){const i=products.findIndex(x=>x.id===p.id);products[i]={...products[i],...body}}else products=[...(await r.json())];
}
function openForm(p=null){editing=p;$("#formTitle").textContent=p?"Edit barang":"Tambah barang";$("#productId").value=p?.id||"";$("#barcode").value=p?.barcode||"";$("#name").value=p?.name||"";$("#brand").value=p?.brand||"";$("#price").value=p?.price||"";$("#stock").value=p?.stock??"";$("#category").value=p?.category||"";$("#image").value=p?.image||"";$("#lookupResult").innerHTML="";$("#productDialog").showModal()}
$("#addBtn").onclick=()=>openForm();$("#closeProduct").onclick=()=>$("#productDialog").close();$("#adminSearch").oninput=renderList;
$("#productForm").onsubmit=async e=>{e.preventDefault(); const p={id:editing?.id||crypto.randomUUID(),barcode:$("#barcode").value.trim(),name:$("#name").value.trim(),brand:$("#brand").value.trim(),price:Number($("#price").value),stock:Number($("#stock").value),category:$("#category").value.trim()||"Lainnya",image:$("#image").value.trim()};editing=p;try{await persist();$("#productDialog").close();renderList()}catch(err){alert(err.message)}};
$("#csvInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;const text=await f.text();const rows=parseCSV(text);if(!rows.length)return alert("CSV kosong.");const imported=rows.map(r=>({id:crypto.randomUUID(),barcode:r.barcode||"",name:r.nama||r.name||"",brand:r.merek||r.brand||"",price:Number(r.harga||r.price||0),stock:Number(r.stok||r.stock||0),category:r.kategori||r.category||"Lainnya",image:r.image||""})).filter(x=>x.name);if(localMode()){products=[...products,...imported];saveLocal();renderList();alert(`${imported.length} barang diimpor.`)}else alert("Untuk mode Supabase, gunakan import via endpoint/server atau masukkan CSV melalui panel yang nanti bisa kita tambah.")}
function parseCSV(t){const lines=t.trim().split(/\r?\n/);if(lines.length<2)return[];const head=lines.shift().split(",").map(x=>x.trim().toLowerCase());return lines.map(line=>{const c=line.split(",");return Object.fromEntries(head.map((h,i)=>[h,(c[i]||"").trim()]))})}
async function removeProduct(id){if(!confirm("Hapus barang ini?"))return;if(localMode()){products=products.filter(p=>p.id!==id);saveLocal();renderList();return}const s=JSON.parse(sessionStorage.getItem("warung-session")||"null");const r=await fetch(`${CFG.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`,{method:"DELETE",headers:{apikey:CFG.SUPABASE_ANON_KEY,Authorization:`Bearer ${s.access_token}`}});if(!r.ok)return alert("Gagal menghapus");products=products.filter(p=>p.id!==id);renderList()}
async function lookupBarcode(code){
  if(!code)return;
  $("#lookupResult").textContent="Mencari data produk...";
  try{const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);const d=await r.json();if(d.status!==1){$("#lookupResult").innerHTML="Produk tidak ditemukan. Isi data manual.";return}const p=d.product||{};const data={name:p.product_name||"",brand:p.brands||"",category:(p.categories_tags?.[0]||"").replace(/^en:/,"").replaceAll("-"," "),image:p.image_front_small_url||p.image_url||""};$("#name").value||($("#name").value=data.name);$("#brand").value||($("#brand").value=data.brand);$("#category").value||($("#category").value=data.category);$("#image").value||($("#image").value=data.image);$("#lookupResult").innerHTML=`✓ Data ditemukan. Silakan koreksi sebelum simpan.`}catch(e){$("#lookupResult").textContent="Pencarian gagal. Isi data manual."}
}
$("#barcode").addEventListener("change",()=>lookupBarcode($("#barcode").value.trim()));
$("#scanBtn").onclick=()=>openScanner("barcode");
$("#formScan").onclick=()=>openScanner("barcode");
async function openScanner(target){
  $("#scannerDialog").showModal();$("#scannerMsg").textContent="Meminta akses kamera...";
  if(!("BarcodeDetector"in window)){ $("#scannerMsg").textContent="Browser ini belum mendukung BarcodeDetector. Isi nomor barcode manual atau gunakan Chrome/Android terbaru."; return; }
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});$("#scannerVideo").srcObject=stream;await $("#scannerVideo").play();
    const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","qr_code"]});
    const loop=async()=>{if(!stream)return;try{const codes=await detector.detect($("#scannerVideo"));if(codes.length){const value=codes[0].rawValue;$("#barcode").value=value;closeScanner();await lookupBarcode(value);return}}catch{}requestAnimationFrame(loop)};loop();
  }catch(e){$("#scannerMsg").textContent="Kamera tidak bisa dibuka. Pastikan izin kamera diberikan dan gunakan HTTPS."}
}
function closeScanner(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$("#scannerDialog").close()}
$("#closeScanner").onclick=closeScanner;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function initials(s){return String(s||"W").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
const theme=localStorage.getItem("warung-theme")||"dark";document.documentElement.dataset.theme=theme;$("#themeBtn").onclick=()=>{const n=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=n;localStorage.setItem("warung-theme",n)};
if(sessionStorage.getItem("warung-admin")||sessionStorage.getItem("warung-session"))init();
