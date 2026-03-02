import { useState } from 'react'
import { Search, ChevronDown, Menu, LogOut, UserCircle, Settings, Shield, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import OrgSelector from './OrgSelector'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from 'next-themes'

export default function TopNavbar({ onMenuToggle }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-30 flex items-center
      bg-slate-950/90 border-b border-slate-800/60 backdrop-blur-md px-4 gap-3">

      {/* Hamburger - mobile */}
      <button
        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 lg:hidden flex-shrink-0"
        onClick={onMenuToggle}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo space - only desktop (sidebar has the real logo) */}
      <div className="hidden lg:block w-[240px] flex-shrink-0" />

      {/* Org Selector */}
      <div className="flex-shrink-0">
        <OrgSelector />
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search orgs, actions, resources…"
            className="input pl-8 py-1.5 text-[13px] h-8 bg-slate-900/60 border-slate-700/60"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono
            bg-slate-800 border border-slate-700 rounded px-1">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {resolvedTheme === 'dark'
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
              userMenuOpen ? 'bg-slate-800' : 'hover:bg-slate-800/60'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AJ'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[13px] font-medium text-slate-200 leading-tight">{user?.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{user?.organization || 'No organization'}</p>
            </div>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-slate-500 transition-transform', userMenuOpen && 'rotate-180')} />
          </button>

          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-[220px] bg-slate-900 border border-slate-700
              rounded-xl shadow-panel z-50 animate-fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                <p className="text-[11px] text-slate-500">{user?.email}</p>
                {user?.organization && (
                  <span className="badge badge-blue mt-1">{user.organization}</span>
                )}
              </div>
              <div className="py-1">
                {[
                  { icon: UserCircle, label: 'Profile', action: () => navigate('/settings') },
                  { icon: Shield,      label: 'Security', action: () => navigate('/settings') },
                  { icon: Settings,    label: 'Settings', action: () => navigate('/settings') },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={() => { action(); setUserMenuOpen(false) }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-300
                      hover:bg-slate-800 hover:text-slate-100 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-slate-500" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-800 py-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400
                    hover:bg-red-900/20 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
