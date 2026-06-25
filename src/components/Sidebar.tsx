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

type SidebarGroup = {
  title: string;
  pages: Page[];
};

const groups: SidebarGroup[] = [
  { title: 'Overview', pages: ['dashboard'] },
  { title: 'People & property', pages: ['properties', 'tenants'] },
  { title: 'Money', pages: ['rent', 'expenses'] },
  { title: 'Repairs & files', pages: ['maintenance', 'documents'] },
  { title: 'System', pages: ['admin'] },
];

const pageColours: Record<string, { active: string; icon: string; dot: string }> = {
  dashboard: {
    active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-950/30',
    icon: 'text-emerald-100',
    dot: 'bg-emerald-300',
  },
  properties: {
    active: 'bg-sky-500 text-white shadow-lg shadow-sky-950/30',
    icon: 'text-sky-100',
    dot: 'bg-sky-300',
  },
  tenants: {
    active: 'bg-violet-500 text-white shadow-lg shadow-violet-950/30',
    icon: 'text-violet-100',
    dot: 'bg-violet-300',
  },
  rent: {
    active: 'bg-amber-500 text-white shadow-lg shadow-amber-950/30',
    icon: 'text-amber-100',
    dot: 'bg-amber-300',
  },
  expenses: {
    active: 'bg-orange-500 text-white shadow-lg shadow-orange-950/30',
    icon: 'text-orange-100',
    dot: 'bg-orange-300',
  },
  maintenance: {
    active: 'bg-rose-500 text-white shadow-lg shadow-rose-950/30',
    icon: 'text-rose-100',
    dot: 'bg-rose-300',
  },
  documents: {
    active: 'bg-cyan-500 text-white shadow-lg shadow-cyan-950/30',
    icon: 'text-cyan-100',
    dot: 'bg-cyan-300',
  },
  admin: {
    active: 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/30',
    icon: 'text-fuchsia-100',
    dot: 'bg-fuchsia-300',
  },
};

export function Sidebar({ visiblePages, currentPage, onPageChange, version }: SidebarProps) {
  const visibleByPage = new Map(visiblePages.map(page => [page.page, page]));

  return (
    <aside className="hidden w-72 flex-col bg-slate-950 text-white md:flex">
      <div className="border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-400/15 p-2 ring-1 ring-emerald-300/30">
            <Building2 className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <strong className="block text-lg leading-tight">PropManagerr</strong>
            <span className="text-xs text-slate-300">Property control centre</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-4">
        {groups.map(group => {
          const pages = group.pages
            .map(page => visibleByPage.get(page))
            .filter(Boolean) as SidebarPage[];

          if (pages.length === 0) return null;

          return (
            <div key={group.title} className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>

              <div className="space-y-1">
                {pages.map(({ page, label, icon: Icon }) => {
                  const active = currentPage === page;
                  const colours = pageColours[page] || pageColours.dashboard;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => onPageChange(page)}
                      className={
                        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' +
                        (active
                          ? colours.active
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white')
                      }
                    >
                      <span className={'h-2 w-2 rounded-full ' + (active ? colours.dot : 'bg-slate-700 group-hover:bg-slate-500')} />
                      <Icon className={'h-4 w-4 ' + (active ? colours.icon : 'text-slate-500 group-hover:text-slate-300')} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 bg-slate-900/70 px-5 py-4 text-xs text-slate-400">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <div className="font-semibold text-slate-200">Version {version}</div>
          <div className="mt-1">&copy; 2026 Christian Robertson</div>
          <div>Licensed under MIT</div>
        </div>
      </div>
    </aside>
  );
}
