create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  category text,
  price numeric not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_category_idx on public.products(category);

alter table public.products enable row level security;

drop policy if exists "public can read available products" on public.products;
create policy "public can read available products"
on public.products for select
using (is_available = true);

-- Prototype policy: any authenticated admin can manage products.
-- Tighten this for production with an admin-role table or JWT claim.
drop policy if exists "authenticated can manage products" on public.products;
create policy "authenticated can manage products"
on public.products for all
to authenticated
using (true)
with check (true);
