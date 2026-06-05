import type { ComponentType } from 'react';
import { Building2 } from 'lucide-react';
import type { Page } from '../types';

type SidebarPage = {
  page: Page;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type SidebarProps = {
  visiblePages: SidebarPage[];
  currentPage: Page;
  onPageChange: (page: Page) => void;
  version: string;
};

export function Sidebar({ visiblePages, currentPage, onPageChange, version }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <Building2 className="text-emerald-400" />
        <strong>PropManagerr</strong>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {visiblePages.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              currentPage === page ? 'bg-emerald-600' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-400 space-y-1">
        <div>Version {version}</div>
        <div>&copy; 2026 Christian Robertson</div>
        <div>Licensed under MIT</div>
      </div>
    </aside>
  );
}