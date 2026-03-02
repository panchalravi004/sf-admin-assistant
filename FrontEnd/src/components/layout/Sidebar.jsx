import { NavLink, useLocation } from 'react-router-dom'
import {
  Building2, Bot, FolderSearch,
  ScrollText, Settings, ChevronRight, Zap, X
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { href: '/orgs',        icon: Building2,       label: 'Orgs',              exact: false },
  { href: '/assistant',   icon: Bot,             label: 'AI Assistant',      exact: false },
  { href: '/resources',   icon: FolderSearch,    label: 'Resources Explorer',exact: false },
  { href: '/logs',        icon: ScrollText,      label: 'Execution Logs',    exact: false },
]

const BOTTOM_ITEMS = [
  { href: '/settings',    icon: Settings,        label: 'Settings',          exact: false },
]

export default function Sidebar({ collapsed, onClose }) {
  const location = useLocation()
  const { user } = useAuth()

  const isActive = (href, exact) => {
    if (exact) return location.pathname === href
    return location.pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'bg-slate-950 border-r border-slate-800/60',
          'transition-transform duration-300 ease-in-out',
          'w-[240px]',
          collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-100 tracking-tight">SF Admin AI</span>
              <span className="block text-[10px] text-slate-500 leading-none">Control Center</span>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <div className="px-2 mb-2">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Navigation</span>
          </div>

          {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact)
            return (
              <NavLink
                key={href}
                to={href}
                onClick={onClose}
                className={clsx(
                  'sidebar-nav-item group',
                  active
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-brand-400' : 'text-current')} />
                <span className="flex-1 text-[13px]">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </NavLink>
            )
          })}

          <div className="px-2 pt-4 mb-2">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">System</span>
          </div>

          {BOTTOM_ITEMS.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact)
            return (
              <NavLink
                key={href}
                to={href}
                onClick={onClose}
                className={clsx(
                  'sidebar-nav-item group',
                  active
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-brand-400' : 'text-current')} />
                <span className="flex-1 text-[13px]">{label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-3 py-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
