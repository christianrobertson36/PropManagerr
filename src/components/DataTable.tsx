type DataTableProps = {
  title: string;
  rows: Record<string, any>[];
};

export function DataTable({ title, rows }: DataTableProps) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="rounded-xl bg-white shadow-sm border overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="font-bold text-slate-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {keys.map(k => (
                  <th key={k} className="px-4 py-3 text-left font-semibold">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {keys.map(k => (
                    <td key={k} className="px-4 py-3 align-top">
                      {r[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
