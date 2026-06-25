import { useState } from 'react';
import { AlertTriangle, FileText, Home, Menu, Receipt, Upload, Wrench, X } from 'lucide-react';
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
  const sectionIds: Record<string, string> = {
    'My rent': 'rent',
    'Upload a document': 'upload',
    'My documents': 'documents',
    'My repairs': 'repairs',
  };
  const sectionId = sectionIds[title];

  return (
    <section id={sectionId} className="scroll-mt-24 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">{empty}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
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

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {columns.map(column => (
              <div key={String(column.key)} className="border-b border-slate-100 py-2 last:border-b-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{column.label}</p>
                <div className="mt-1 break-words text-sm text-slate-800">
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? '-')}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function TenantPortal({ data, user, refresh }: { data: DashboardData; user: User; refresh?: () => Promise<void> }) {
  const tenant = data.tenants.find(row => row.id === user.tenant_id) || null;
  const tenantPropertyId = tenant?.property_id || tenant?.property?.id || data.properties[0]?.id || '';
  const property = tenant?.property || data.properties.find(row => row.id === tenantPropertyId) || data.properties[0] || null;
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('tenant_upload');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault();
    setPasswordNotice('');
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice('Password changed. Use the new password next time you sign in.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function submitTenantUpload(event: React.FormEvent) {
    event.preventDefault();
    setUploadNotice('');
    setUploadError('');

    if (!tenant) {
      setUploadError('No tenant record is linked to this login yet.');
      return;
    }

    if (!uploadFile) {
      setUploadError('Choose a file or photo first.');
      return;
    }

    setUploadSaving(true);
    try {
      const uploaded = await api.uploadDocument(uploadFile);
      const safeTitle = uploadTitle.trim() || uploaded.original_name || uploadFile.name || 'Tenant upload';

      await api.createDocument({
        tenant_id: tenant.id,
        property_id: tenantPropertyId || property?.id || null,
        name: safeTitle,
        doc_type: uploadType || 'tenant_upload',
        expiry_date: null,
        file_url: uploaded.file_url,
      });

      setUploadTitle('');
      setUploadType('tenant_upload');
      setUploadFile(null);
      setUploadNotice('Upload saved. Your landlord can now see this document.');
      if (refresh) await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploadSaving(false);
    }
  }

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
    <div className="relative max-w-full overflow-x-hidden">
      <button
        type="button"
        onClick={() => setMobileMenuOpen(value => !value)}
        className="fixed right-3 top-3 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-lg md:hidden"
        aria-label="Open tenant menu"
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {mobileMenuOpen && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:hidden">
          <div className="grid grid-cols-2 gap-2 text-sm font-semibold text-slate-800">
            <a onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 hover:bg-slate-100" href="#rent">
              <Receipt className="h-5 w-5" />
              Rent
            </a>
            <a onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 hover:bg-slate-100" href="#upload">
              <Upload className="h-5 w-5" />
              Upload
            </a>
            <a onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 hover:bg-slate-100" href="#documents">
              <FileText className="h-5 w-5" />
              Docs
            </a>
            <a onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 hover:bg-slate-100" href="#repairs">
              <Wrench className="h-5 w-5" />
              Repairs
            </a>
          </div>
        </div>
      )}

      <div className="space-y-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm sm:p-6">
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


        <TenantCard title="Change my password">
          <form onSubmit={submitPasswordChange} className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Use this to set your own password after receiving a temporary login. Keep it private and do not share it.
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Current password
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              New password
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Confirm new password
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            {passwordNotice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{passwordNotice}</div>}
            {passwordError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{passwordError}</div>}

            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full rounded-lg bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordSaving ? 'Changing...' : 'Change password'}
            </button>
          </form>
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

      <TenantCard title="Upload a document">
        <form onSubmit={submitTenantUpload} className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            On mobile, tap Choose file to take a photo or pick a saved file. Use this for IDs, signed papers, photos, receipts or anything your landlord has asked for.
          </div>

          <label className="block text-sm font-medium text-slate-700">
            What are you uploading?
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={uploadTitle}
              onChange={event => setUploadTitle(event.target.value)}
              placeholder="Example: Signed agreement photo"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Upload type
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={uploadType}
              onChange={event => setUploadType(event.target.value)}
            >
              <option value="tenant_upload">Tenant upload</option>
              <option value="tenancy_agreement">Tenancy agreement</option>
              <option value="id_document">ID document</option>
              <option value="repair_photo">Repair photo</option>
              <option value="receipt">Receipt</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
            <span className="block font-semibold text-slate-900">Choose file or photo</span>
            <span className="mt-1 block text-slate-600">PDF, image, Word document or text file. Photos from a phone camera are supported.</span>
            <input
              className="mt-3 block w-full text-base text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white"
              type="file"
              accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
              onChange={event => setUploadFile(event.target.files?.[0] || null)}
            />
          </label>

          {uploadFile && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              Selected: <span className="font-medium text-slate-900">{uploadFile.name}</span>
            </div>
          )}

          {uploadNotice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{uploadNotice}</div>}
          {uploadError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{uploadError}</div>}

          <button
            type="submit"
            disabled={!uploadFile || uploadSaving}
            className="w-full rounded-lg bg-emerald-600 px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadSaving ? 'Uploading...' : 'Upload document'}
          </button>
        </form>
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
                <a className="inline-flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 md:w-auto md:bg-transparent md:px-0 md:py-0 md:text-emerald-700 md:hover:bg-transparent md:hover:underline" href={api.documentFileUrl(row.file_url)} target="_blank" rel="noreferrer">View</a>
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
</div>
  );
}
