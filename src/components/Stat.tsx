import type { ComponentType } from 'react';

type StatProps = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
};

export function Stat({ label, value, icon: Icon }: StatProps) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border flex items-center gap-4">
      <Icon className="w-8 h-8 text-emerald-600" />
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
