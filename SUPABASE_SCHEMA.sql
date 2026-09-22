create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  category text,
  price numeric not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  stock_status text not null default 'available' check (stock_status in ('available', 'low')),
  image text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_category_idx on public.products(category);

alter table public.products add column if not exists stock_status text not null default 'available';
alter table public.products drop constraint if exists products_stock_status_check;
alter table public.products add constraint products_stock_status_check check (stock_status in ('available', 'low'));
update public.products set stock_status = case when stock_status is null then 'available' else stock_status end;

alter table public.products enable row level security;

-- Karena frontend memakai Edge Function, key/database tidak diakses langsung dari browser.
-- Tidak ada policy publik yang dibutuhkan; Edge Function memakai service-role server-side.
drop policy if exists "public can read available products" on public.products;
drop policy if exists "authenticated can manage products" on public.products;

