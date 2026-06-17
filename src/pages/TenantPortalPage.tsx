import { AlertTriangle, FileText, Home, Receipt, Wrench } from 'lucide-react';
import { api } from '../api';
import type { DashboardData, DocumentRecord, MaintenanceTicket, RentPayment, User } from '../types';

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function money(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '£0.00';
  return `£${numeric.toFixed(2)}`;
}

function TenantCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Home }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SimpleTable<T>({
  columns,
  rows,
  empty,
}: {
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }[];
  rows: T[];
  empty: string;
}) {
  return rows.length === 0 ? (
    <p className="text-sm text-slate-600">{empty}</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={String(column.key)} className="px-3 py-2 text-left font-semibold text-slate-700">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(column => (
                <td key={String(column.key)} className="px-3 py-2 align-top text-slate-700">
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TenantPortal({ data, user }: { data: DashboardData; user: User }) {
  const tenant = data.tenants.find(row => row.id === user.tenant_id) || null;
  const tenantPropertyId = tenant?.property_id || tenant?.property?.id || data.properties[0]?.id || '';
  const property = tenant?.property || data.properties.find(row => row.id === tenantPropertyId) || data.properties[0] || null;

  const rentPayments = data.rentPayments.filter(payment =>
    payment.tenant_id === user.tenant_id || Boolean(tenantPropertyId && payment.property_id === tenantPropertyId)
  );
  const documents = data.documents.filter(document => {
    const documentPropertyId = document.property_id || document.property?.id;
    const isGlobalDocument = !document.tenant_id && !documentPropertyId;
    return (
      isGlobalDocument ||
      document.tenant_id === user.tenant_id ||
      Boolean(tenantPropertyId && documentPropertyId === tenantPropertyId)
    );
  });
  const repairs = data.maintenanceTickets.filter(ticket => {
    const ticketPropertyId = ticket.property_id || ticket.property?.id;
    return ticket.tenant_id === user.tenant_id || Boolean(tenantPropertyId && ticketPropertyId === tenantPropertyId);
  });

  const rentOutstanding = rentPayments
    .filter(payment => payment.status !== 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openRepairs = repairs.filter(ticket => ticket.status !== 'resolved').length;
  const nextRent = rentPayments
    .filter(payment => payment.status !== 'paid')
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const tenancyDocuments = documents.filter(document => document.doc_type === 'tenancy_agreement');
  const urgentDocuments = documents
    .filter(document => {
      if (!document.expiry_date) return false;
      const days = Math.ceil((new Date(document.expiry_date).getTime() - Date.now()) / 86_400_000);
      return days <= 30;
    })
    .slice()
    .sort((a, b) => new Date(a.expiry_date || '').getTime() - new Date(b.expiry_date || '').getTime());
  const latestDocuments = documents
    .slice()
    .sort((a, b) => new Date(b.created_at || b.expiry_date || '').getTime() - new Date(a.created_at || a.expiry_date || '').getTime())
    .slice(0, 3);
  const latestRepairs = repairs
    .slice()
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm text-emerald-200">Tenant portal</p>
        <h1 className="mt-1 text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="mt-2 text-sm text-slate-300">Your property, rent, tenancy documents and repair updates in one simple place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MiniStat label="Outstanding rent" value={money(rentOutstanding)} icon={Receipt} />
        <MiniStat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
        <MiniStat label="Documents" value={String(documents.length)} icon={FileText} />
        <MiniStat label="Property" value={property ? 'Assigned' : 'Missing'} icon={property ? Home : AlertTriangle} />
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Tenant quick summary</p>
            <p className="mt-1 text-sm text-emerald-800">
              {nextRent ? 'Next rent due ' + dateOnly(nextRent.due_date) + ' for ' + money(nextRent.amount) + '.' : 'No unpaid rent is currently showing.'}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {tenancyDocuments.length > 0 ? tenancyDocuments.length + ' tenancy agreement document(s) available.' : 'No saved tenancy agreement document is visible yet.'}
            </p>
          </div>
          <div className="rounded-lg bg-white/70 px-4 py-3 text-sm text-emerald-900">
            {urgentDocuments.length > 0 ? urgentDocuments.length + ' document(s) need attention soon.' : 'No urgent document reminders.'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TenantCard title="My property">
          {property ? (
            <dl className="space-y-2 text-sm text-slate-700">
              <div><dt className="font-medium text-slate-900">Address</dt><dd>{property.address}</dd></div>
              <div><dt className="font-medium text-slate-900">City</dt><dd>{property.city || '-'}</dd></div>
              <div><dt className="font-medium text-slate-900">Postcode</dt><dd>{property.postcode || '-'}</dd></div>
              <div><dt className="font-medium text-slate-900">Type</dt><dd>{property.property_type || '-'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">No property assigned yet.</p>
          )}
        </TenantCard>

        <TenantCard title="My tenancy">
          {tenant ? (
            <dl className="space-y-2 text-sm text-slate-700">
              <div><dt className="font-medium text-slate-900">Tenant</dt><dd>{tenant.name}</dd></div>
              <div><dt className="font-medium text-slate-900">Email</dt><dd>{tenant.email || '-'}</dd></div>
              <div><dt className="font-medium text-slate-900">Lease start</dt><dd>{dateOnly(tenant.lease_start) || '-'}</dd></div>
              <div><dt className="font-medium text-slate-900">Lease end</dt><dd>{dateOnly(tenant.lease_end) || '-'}</dd></div>
              <div><dt className="font-medium text-slate-900">Payment status</dt><dd>{tenant.payment_status || '-'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">No tenancy details found.</p>
          )}
        </TenantCard>
      </div>

      <TenantCard title="My rent">
        {nextRent && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Next rent due: <strong>{money(nextRent.amount)}</strong> on {dateOnly(nextRent.due_date)} · {nextRent.status}
          </div>
        )}
        <SimpleTable<RentPayment>
          empty="No rent payments found."
          columns={[
            { key: 'amount', label: 'Amount', render: row => money(row.amount) },
            { key: 'due_date', label: 'Due', render: row => dateOnly(row.due_date) || '-' },
            { key: 'paid_date', label: 'Paid', render: row => dateOnly(row.paid_date) || '-' },
            { key: 'status', label: 'Status' },
          ]}
          rows={rentPayments}
        />
      </TenantCard>

      <TenantCard title="My documents">
        {tenancyDocuments.length > 0 && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Your tenancy agreement is available below. Open the document to view or download it.
          </div>
        )}
        {urgentDocuments.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {urgentDocuments.length} document(s) expire within 30 days or are overdue. Please contact the landlord if anything needs renewing.
          </div>
        )}
        <SimpleTable<DocumentRecord>
          empty="No documents have been shared with you yet."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'doc_type', label: 'Type' },
            { key: 'expiry_date', label: 'Expiry', render: row => dateOnly(row.expiry_date) || '-' },
            {
              key: 'file_url',
              label: 'File',
              render: row => row.file_url ? (
                <a className="font-medium text-emerald-700 hover:underline" href={api.documentFileUrl(row.file_url)} target="_blank" rel="noreferrer">View</a>
              ) : 'Not uploaded',
            },
          ]}
          rows={documents}
        />
      </TenantCard>

      <TenantCard title="My repairs">
        {latestRepairs.length > 0 && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Latest update: {latestRepairs[0].title} — {latestRepairs[0].status}.
          </div>
        )}
        <SimpleTable<MaintenanceTicket>
          empty="No repairs reported yet."
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'property_id', label: 'Address', render: row => row.property?.address || property?.address || row.property_id || '-' },
            { key: 'urgency', label: 'Urgency' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Created', render: row => dateOnly(row.created_at) || '-' },
          ]}
          rows={repairs}
        />
      </TenantCard>
    </div>
  );
}
