/* ==========================================================
   KATALOG WARUNG — logika utama
   Data produk & pengaturan disimpan di Firebase Firestore,
   jadi SEMUA pengunjung melihat katalog yang sama secara
   realtime (bukan cuma tersimpan di satu HP).
   ========================================================== */

/* ---------------- 1. ISI KONFIGURASI FIREBASE KAMU DI SINI ----------------
   Ambil dari: Firebase Console -> Project settings -> General
   -> scroll ke "Your apps" -> Web app -> SDK setup and configuration
------------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDzqQgQq4G9xcxpgvlHIg2NBcA3TmtjZyY",
  authDomain: "katalog-warung-82fd1.firebaseapp.com",
  projectId: "katalog-warung-82fd1",
  storageBucket: "katalog-warung-82fd1.firebasestorage.app",
  messagingSenderId: "150276917624",
  appId: "1:150276917624:web:4a2f502914c3edfea6e08d"
};

const ADMIN_CODE = "989"; // harus SAMA PERSIS dengan kode di Firestore Security Rules

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const productsRef = db.collection("products");
const settingsRef = db.collection("settings").doc("store");

/* ---------------- Elemen ---------------- */
const els = {
  storeName: document.getElementById("storeName"),
  brandTrigger: document.getElementById("brandTrigger"),
  btnExitAdmin: document.getElementById("btnExitAdmin"),
  searchInput: document.getElementById("searchInput"),
  categoryChips: document.getElementById("categoryChips"),
  grid: document.getElementById("catalogGrid"),
  emptyState: document.getElementById("emptyState"),
  syncState: document.getElementById("syncState"),
  waFloat: document.getElementById("waFloat"),

  adminOverlay: document.getElementById("adminOverlay"),
  btnCloseAdmin: document.getElementById("btnCloseAdmin"),
  productForm: document.getElementById("productForm"),
  productId: document.getElementById("productId"),
  fName: document.getElementById("fName"),
  fCategory: document.getElementById("fCategory"),
  fPrice: document.getElementById("fPrice"),
  fStock: document.getElementById("fStock"),
  fImageFile: document.getElementById("fImageFile"),
  fImageUrl: document.getElementById("fImageUrl"),
  fDesc: document.getElementById("fDesc"),
  btnSave: document.getElementById("btnSave"),
  btnCancelEdit: document.getElementById("btnCancelEdit"),
  adminList: document.getElementById("adminList"),
  adminCount: document.getElementById("adminCount"),

  sStoreName: document.getElementById("sStoreName"),
  sWaNumber: document.getElementById("sWaNumber"),
  btnSaveSettings: document.getElementById("btnSaveSettings"),

  pinOverlay: document.getElementById("pinOverlay"),
  pinInput: document.getElementById("pinInput"),
  btnPinOk: document.getElementById("btnPinOk"),
  btnPinCancel: document.getElementById("btnPinCancel"),
  pinError: document.getElementById("pinError"),
};

let state = { activeCategory: "Semua", search: "" };
let products = [];
let settings = { storeName: "Warung", waNumber: "" };
let adminOpen = false;

/* ---------------- Format ---------------- */
function formatRupiah(n){
  return "Rp" + Number(n||0).toLocaleString("id-ID");
}
function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/* ---------------- Sinkron realtime dari Firestore ---------------- */
productsRef.orderBy("createdAt", "desc").onSnapshot(
  (snapshot)=>{
    products = snapshot.docs.map(doc=> ({ id: doc.id, ...doc.data() }));
    els.syncState.hidden = true;
    renderCategories();
    renderCatalog();
    if (adminOpen) renderAdminList();
  },
  (err)=>{
    console.error(err);
    els.syncState.hidden = false;
    els.syncState.textContent = "Gagal memuat katalog. Cek koneksi internet atau konfigurasi Firebase.";
  }
);

settingsRef.onSnapshot((doc)=>{
  if (doc.exists){
    settings = doc.data();
  }
  renderTopLevel();
  renderCatalog();
});

/* ---------------- Render katalog publik ---------------- */
function renderCategories(){
  const cats = ["Semua", ...new Set(products.map(p=>p.category).filter(Boolean))];
  els.categoryChips.innerHTML = "";
  cats.forEach(cat=>{
    const chip = document.createElement("button");
    chip.className = "chip" + (cat===state.activeCategory ? " active":"");
    chip.textContent = cat;
    chip.onclick = ()=>{ state.activeCategory = cat; renderCategories(); renderCatalog(); };
    els.categoryChips.appendChild(chip);
  });
}

function waLink(number, message){
  const num = (number||"").replace(/[^0-9]/g,"");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function renderCatalog(){
  const q = state.search.trim().toLowerCase();
  const filtered = products.filter(p=>{
    const matchCat = state.activeCategory === "Semua" || p.category === state.activeCategory;
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  els.grid.innerHTML = "";
  els.emptyState.hidden = filtered.length !== 0 || !els.syncState.hidden;

  filtered.forEach(p=>{
    const card = document.createElement("article");
    card.className = "card";

    const imgWrap = document.createElement("div");
    imgWrap.className = "card-img";
    if (p.image){
      const img = document.createElement("img");
      img.src = p.image; img.alt = p.name; img.loading = "lazy";
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = `<span class="ph">🛒</span>`;
    }
    if (p.stock === "habis"){
      const b = document.createElement("div");
      b.className = "badge-habis";
      b.textContent = "Stok habis";
      imgWrap.appendChild(b);
    }
    card.appendChild(imgWrap);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <div class="card-name">${escapeHtml(p.name)}</div>
      <div class="card-cat">${escapeHtml(p.category||"")}</div>
      <div class="card-price">${formatRupiah(p.price)}</div>
      ${p.desc ? `<div class="card-desc">${escapeHtml(p.desc)}</div>` : ""}
    `;

    const btn = document.createElement("a");
    btn.className = "btn-order" + (p.stock === "habis" ? " disabled" : "");
    btn.target = "_blank"; btn.rel = "noopener";
    const msg = `Halo ${settings.storeName || "warung"}, saya mau pesan: ${p.name} (${formatRupiah(p.price)})`;
    btn.href = p.stock === "habis" ? "#" : waLink(settings.waNumber, msg);
    btn.textContent = p.stock === "habis" ? "Stok habis" : "Pesan via WA";
    body.appendChild(btn);

    card.appendChild(body);
    els.grid.appendChild(card);
  });
}

function renderTopLevel(){
  els.storeName.textContent = settings.storeName || "Warung";
  const genericMsg = `Halo ${settings.storeName || "warung"}, saya mau tanya-tanya produk.`;
  els.waFloat.href = settings.waNumber ? waLink(settings.waNumber, genericMsg) : "#";
}

/* ---------------- Admin: triple-tap trigger ---------------- */
let tapCount = 0, tapTimer = null;
els.brandTrigger.addEventListener("click", ()=>{
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(()=> tapCount = 0, 800);
  if (tapCount >= 3){
    tapCount = 0;
    openPinModal();
  }
});

function openPinModal(){
  els.pinInput.value = "";
  els.pinError.hidden = true;
  els.pinOverlay.hidden = false;
  els.pinInput.focus();
}
els.btnPinCancel.onclick = ()=> els.pinOverlay.hidden = true;
els.btnPinOk.onclick = tryPin;
els.pinInput.addEventListener("keydown", e=>{ if(e.key === "Enter") tryPin(); });

function tryPin(){
  if (els.pinInput.value === ADMIN_CODE){
    els.pinOverlay.hidden = true;
    openAdmin();
  } else {
    els.pinError.hidden = false;
  }
}

/* ---------------- Panel admin ---------------- */
function openAdmin(){
  adminOpen = true;
  els.adminOverlay.hidden = false;
  els.btnExitAdmin.hidden = false;
  els.sStoreName.value = settings.storeName || "";
  els.sWaNumber.value = settings.waNumber || "";
  resetForm();
  renderAdminList();
}
function closeAdmin(){
  adminOpen = false;
  els.adminOverlay.hidden = true;
  els.btnExitAdmin.hidden = true;
}
els.btnCloseAdmin.onclick = closeAdmin;
els.btnExitAdmin.onclick = closeAdmin;

function resetForm(){
  els.productId.value = "";
  els.productForm.reset();
  els.btnSave.textContent = "Tambah produk";
  els.btnCancelEdit.hidden = true;
}
els.btnCancelEdit.onclick = resetForm;

function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

els.productForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const id = els.productId.value;
  let image = els.fImageUrl.value.trim();
  const file = els.fImageFile.files[0];
  if (file){
    if (file.size > 700 * 1024){
      alert("Gambar terlalu besar untuk disimpan langsung (maks ±700KB). Pakai URL gambar saja untuk foto besar.");
      return;
    }
    try { image = await fileToDataUrl(file); }
    catch(err){ alert("Gagal membaca gambar."); return; }
  }

  const data = {
    name: els.fName.value.trim(),
    category: els.fCategory.value.trim(),
    price: Number(els.fPrice.value) || 0,
    stock: els.fStock.value,
    desc: els.fDesc.value.trim(),
    adminCode: ADMIN_CODE, // dicek oleh Firestore Security Rules
  };
  if (image) data.image = image;
  else if (!id) data.image = "";

  els.btnSave.disabled = true;
  try {
    if (id){
      await productsRef.doc(id).update(data);
    } else {
      data.image = data.image || "";
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await productsRef.add(data);
    }
    resetForm();
  } catch(err){
    console.error(err);
    alert("Gagal menyimpan ke server. Cek koneksi internet / konfigurasi Firebase.");
  } finally {
    els.btnSave.disabled = false;
  }
});

function renderAdminList(){
  els.adminCount.textContent = products.length;
  els.adminList.innerHTML = "";
  products.forEach(p=>{
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${p.image ? `<img src="${p.image}" alt="">` : `<div class="ph-sm">🛒</div>`}
      <div class="admin-row-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${escapeHtml(p.category||"")} · ${formatRupiah(p.price)} · ${p.stock==="habis"?"Habis":"Tersedia"}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn-edit" data-id="${p.id}">Ubah</button>
        <button class="btn-del" data-id="${p.id}">Hapus</button>
      </div>
    `;
    els.adminList.appendChild(row);
  });

  els.adminList.querySelectorAll(".btn-edit").forEach(btn=>{
    btn.onclick = ()=> editProduct(btn.dataset.id);
  });
  els.adminList.querySelectorAll(".btn-del").forEach(btn=>{
    btn.onclick = ()=> deleteProduct(btn.dataset.id);
  });
}

function editProduct(id){
  const p = products.find(x=>x.id===id);
  if (!p) return;
  els.productId.value = p.id;
  els.fName.value = p.name;
  els.fCategory.value = p.category;
  els.fPrice.value = p.price;
  els.fStock.value = p.stock;
  els.fImageUrl.value = p.image && p.image.startsWith("http") ? p.image : "";
  els.fDesc.value = p.desc || "";
  els.btnSave.textContent = "Simpan perubahan";
  els.btnCancelEdit.hidden = false;
  els.productForm.scrollIntoView({behavior:"smooth"});
}

async function deleteProduct(id){
  if (!confirm("Hapus produk ini?")) return;
  try {
    await productsRef.doc(id).delete();
  } catch(err){
    console.error(err);
    alert("Gagal menghapus di server.");
  }
}

els.btnSaveSettings.onclick = async ()=>{
  const data = {
    storeName: els.sStoreName.value.trim() || "Warung",
    waNumber: els.sWaNumber.value.trim(),
    adminCode: ADMIN_CODE,
  };
  els.btnSaveSettings.disabled = true;
  try {
    await settingsRef.set(data, { merge: true });
    alert("Pengaturan disimpan.");
  } catch(err){
    console.error(err);
    alert("Gagal menyimpan pengaturan ke server.");
  } finally {
    els.btnSaveSettings.disabled = false;
  }
};

/* ---------------- Cari & filter publik ---------------- */
els.searchInput.addEventListener("input", (e)=>{
  state.search = e.target.value;
  renderCatalog();
});
