create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','tenant')),
  tenant_id uuid null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text not null,
  postcode text not null,
  status text not null default 'active' check (status in ('active','vacant','maintenance')),
  monthly_rent numeric(10,2) not null default 0,
  bedrooms integer not null default 1,
  property_type text not null default 'House',
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  property_id uuid references properties(id) on delete set null,
  lease_start date,
  lease_end date,
  payment_status text not null default 'pending' check (payment_status in ('paid','overdue','pending')),
  created_at timestamptz not null default now()
);

DO $$ BEGIN
  ALTER TABLE app_users ADD CONSTRAINT app_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create table if not exists rent_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  amount numeric(10,2) not null,
  due_date date not null,
  paid_date date,
  status text not null default 'pending' check (status in ('paid','overdue','pending')),
  created_at timestamptz not null default now()
);

create table if not exists maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  urgency text not null default 'medium' check (urgency in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  name text not null,
  doc_type text not null check (doc_type in ('tenancy_agreement','gas_safety','epc','eicr','deposit_protection','right_to_rent','smoke_co_alarm','other')),
  expiry_date date,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  category text not null,
  amount numeric(10,2) not null,
  date date not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  action text not null,
  table_name text not null,
  row_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenants_property on tenants(property_id);
create index if not exists idx_rent_tenant on rent_payments(tenant_id);
create index if not exists idx_maintenance_property on maintenance_tickets(property_id);
create index if not exists idx_documents_expiry on documents(expiry_date);
