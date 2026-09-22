# Warung Online — GitHub Pages + Supabase

Katalog digital warung dengan:
- Dark mode elegan
- Katalog mobile-first
- Search + kategori
- Keranjang
- Pesan via WhatsApp
- PWA/installable
- Panel admin
- Scan barcode (browser yang mendukung `BarcodeDetector`)
- Lookup produk via Open Food Facts
- Import CSV untuk mode development lokal

## 1. Jalankan lokal
Karena browser memblokir beberapa request jika file dibuka langsung, gunakan server lokal.

Contoh:
`python3 -m http.server 8080`

Buka `http://localhost:8080`

## 2. Mode development
Sebelum Supabase dikonfigurasi, admin memakai `localStorage` untuk mencoba alur tambah/edit/hapus produk.
Ini **bukan sistem keamanan production**.

## 3. Production
Buat project Supabase, lalu:
1. Buat tabel `products`.
2. Buat Auth user untuk admin.
3. Aktifkan RLS.
4. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `config.js`.
5. Jangan pernah memasukkan `service_role` key ke frontend/GitHub.
6. Ganti nomor WhatsApp di `config.js`.

Contoh SQL awal:

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  category text,
  price numeric not null default 0,
  stock integer not null default 0,
  image text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "public can read available products"
on public.products for select
using (is_available = true);

create policy "authenticated can manage products"
on public.products for all
to authenticated
using (true)
with check (true);
```

**Catatan keamanan:** policy `authenticated can manage products` di atas cocok untuk prototype satu-admin, tetapi untuk production sebaiknya dibatasi lagi berdasarkan user/admin role. Jangan gunakan service-role key di browser.

## 4. Barcode
Scanner memakai `BarcodeDetector` jika tersedia. Karena kamera browser memerlukan secure context, GitHub Pages/HTTPS diperlukan untuk pemakaian online.

Data lookup contoh memakai Open Food Facts. Hasil lookup harus selalu dikoreksi sebelum disimpan; database eksternal bukan sumber kebenaran harga warung.

## 5. Import awal
Untuk tahap pengisian barang awal, gunakan CSV:
```csv
nama,harga,stok,kategori,merek,barcode,image
Indomie Goreng,3500,20,Makanan,Indomie,899..., 
Aqua 600ml,3000,24,Minuman,Aqua,899...,
```

Mode development bisa mengimpor CSV ke localStorage. Untuk production, import massal sebaiknya dilakukan lewat backend/SQL/importer yang tervalidasi agar tidak membebani browser dan tetap tunduk pada RLS.

## 6. Deploy GitHub Pages
Push seluruh folder ini ke repository GitHub. Aktifkan Pages dari branch utama dan folder root. Setelah HTTPS aktif, PWA dan kamera barcode dapat digunakan pada perangkat yang mendukungnya.


## Mode produksi: key Supabase tidak di frontend

Versi ini memakai Supabase Edge Function (`supabase/functions/warung-api`) sebagai API. `SUPABASE_ANON_KEY` dan terutama `SUPABASE_SERVICE_ROLE_KEY` tidak ditaruh di GitHub/frontend. Simpan keduanya sebagai Secrets di Supabase Edge Functions.

Langkah ringkas:
1. Jalankan `SUPABASE_SCHEMA.sql` di Supabase SQL Editor.
2. Deploy function `warung-api` dengan Supabase CLI.
3. Set secrets `SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` pada project Supabase. `SUPABASE_URL` sudah tersedia sebagai environment bawaan Edge Functions.
4. Isi `config.js` hanya dengan `SUPABASE_URL` dan URL function pada `API_BASE`, contoh `https://PROJECT_REF.supabase.co/functions/v1/warung-api`. Jangan isi key di file frontend.
5. Buat user admin di Supabase Authentication.

Dengan mode ini, katalog publik mengambil data melalui Edge Function, sedangkan tambah/edit/hapus barang harus memakai sesi admin.

### Status stok
Panel admin sekarang tidak meminta angka stok. Pilih salah satu: **Tersedia** atau **Stok hampir habis**. Data status disimpan di kolom `stock_status`.
