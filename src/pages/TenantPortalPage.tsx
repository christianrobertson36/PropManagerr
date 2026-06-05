import { AlertTriangle, Receipt, Wrench } from 'lucide-react';
import { api } from '../api';
import type { DashboardData, User } from '../types';
import { DataTable } from '../components/DataTable';
import { Stat } from '../components/Stat';

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function TenantPortal({ data, user }: { data: DashboardData; user: User }) {
  const tenant =
    data.tenants.find(t => t.id === user.tenant_id) ||
    data.tenants[0] ||
    null;
  const property = tenant?.property || data.properties[0] || null;
  const rentPaid = data.rentPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const rentOutstanding = data.rentPayments
    .filter(p => p.status !== 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openRepairs = data.maintenanceTickets.filter(t => t.status !== 'resolved').length;
  const nextRent = data.rentPayments
    .filter(p => p.status !== 'paid')
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="text-xl font-bold text-slate-900">Welcome, {user.name}</h2>
        <p className="text-sm text-slate-500">Your tenant portal for rent, documents and repairs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Rent paid" value={`£${rentPaid}`} icon={Receipt} />
        <Stat label="Outstanding" value={`£${rentOutstanding}`} icon={AlertTriangle} />
        <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm border">
          <h2 className="font-bold text-slate-900 mb-3">My property</h2>
          {property ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-600">Address:</span> {property.address}</p>
              <p><span className="font-medium text-slate-600">City:</span> {property.city || '-'}</p>
              <p><span className="font-medium text-slate-600">Postcode:</span> {property.postcode || '-'}</p>
              <p><span className="font-medium text-slate-600">Type:</span> {property.property_type || '-'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No property assigned yet.</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border">
          <h2 className="font-bold text-slate-900 mb-3">My tenancy</h2>
          {tenant ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-600">Tenant:</span> {tenant.name}</p>
              <p><span className="font-medium text-slate-600">Email:</span> {tenant.email || '-'}</p>
              <p><span className="font-medium text-slate-600">Lease start:</span> {dateOnly(tenant.lease_start) || '-'}</p>
              <p><span className="font-medium text-slate-600">Lease end:</span> {dateOnly(tenant.lease_end) || '-'}</p>
              <p><span className="font-medium text-slate-600">Payment status:</span> {tenant.payment_status || '-'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No tenancy details found.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="font-bold text-slate-900 mb-3">Next rent due</h2>
        {nextRent ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">£{nextRent.amount}</p>
              <p className="text-sm text-slate-500">Due {dateOnly(nextRent.due_date)} · {nextRent.status}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No outstanding rent payments.</p>
        )}
      </div>

      <DataTable
        title="My rent history"
        rows={data.rentPayments.map(p => ({
          amount: `£${p.amount}`,
          due: dateOnly(p.due_date),
          paid: dateOnly(p.paid_date) || '-',
          status: p.status,
        }))}
      />

      <DataTable
        title="My documents"
        rows={data.documents.map(d => ({
          name: d.name,
          type: d.doc_type,
          expiry: dateOnly(d.expiry_date) || '-',
          file: d.file_url ? (
            <a
              href={api.documentFileUrl(d.file_url)}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
            >
              View
            </a>
          ) : 'Not uploaded',
        }))}
      />

      <DataTable
        title="My repairs"
        rows={data.maintenanceTickets.map(t => ({
          title: t.title,
          property: t.property?.address || t.property_id,
          urgency: t.urgency,
          status: t.status,
          created: dateOnly(t.created_at),
        }))}
      />
    </div>
  );
}
