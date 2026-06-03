insert into properties (id, address, city, postcode, status, monthly_rent, bedrooms, property_type) values
('11111111-1111-1111-1111-111111111111','14 Birchwood Avenue','Manchester','M20 4QR','active',1350,3,'Semi-detached')
on conflict (id) do nothing;

insert into app_users (id, name, email, password_hash, role) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Admin User','admin@propmanager.local', crypt('ChangeMe123!', gen_salt('bf')), 'admin')
on conflict (email) do nothing;

insert into tenants (id, name, email, phone, property_id, lease_start, lease_end, payment_status) values
('22222222-2222-2222-2222-222222222222','Trial Tenant','tenant@example.local','07700 900000','11111111-1111-1111-1111-111111111111','2026-01-01','2026-12-31','pending')
on conflict (id) do nothing;

insert into app_users (id, name, email, password_hash, role, tenant_id) values
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Trial Tenant','tenant@example.local', crypt('ChangeMe123!', gen_salt('bf')), 'tenant','22222222-2222-2222-2222-222222222222')
on conflict (email) do nothing;

update tenants set user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id='22222222-2222-2222-2222-222222222222';

insert into rent_payments (tenant_id, property_id, amount, due_date, paid_date, status) values
('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',1350,'2026-06-01',null,'pending'),
('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',1350,'2026-05-01','2026-05-01','paid');

insert into documents (property_id, tenant_id, name, doc_type, expiry_date, file_url) values
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Tenancy Agreement','tenancy_agreement','2026-12-31',null),
('11111111-1111-1111-1111-111111111111',null,'Gas Safety Certificate','gas_safety','2026-09-01',null),
('11111111-1111-1111-1111-111111111111',null,'EICR','eicr','2031-01-01',null)
on conflict do nothing;

insert into maintenance_tickets (title, description, property_id, tenant_id, urgency, status) values
('Leaking tap','Kitchen tap drips when turned off.','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','medium','open');

insert into expenses (property_id, category, amount, date, description) values
('11111111-1111-1111-1111-111111111111','Repairs',85,'2026-05-15','Plumbing callout');
