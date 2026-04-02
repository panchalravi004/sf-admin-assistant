import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import clsx from 'clsx'

import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'

import Sidebar from './components/layout/Sidebar'
import TopNavbar from './components/layout/TopNavbar'

import Orgs from './pages/Orgs'
import OrgDetail from './pages/OrgDetail'
import Assistant from './pages/Assistant'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Login from './pages/Login'
import SignUp from './pages/SignUp'

// Pages that use full viewport height (no inner scroll padding)
const FULL_HEIGHT_ROUTES = ['/assistant', '/resources']

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  })
  const location = useLocation()
  const isFullHeight = FULL_HEIGHT_ROUTES.some(r => location.pathname.startsWith(r))

  return (
    <div className="h-screen overflow-hidden bg-slate-950 flex">
      <Sidebar
        collapsed={!sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className={clsx(
        'flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out',
        sidebarOpen ? 'lg:pl-[240px]' : 'lg:pl-0'
      )}>
        <TopNavbar
          onMenuToggle={() => setSidebarOpen(o => !o)}
          sidebarOpen={sidebarOpen}
        />

        {/* Content area */}
        <main className={clsx(
          'flex-1 flex flex-col pt-14', // pt-14 = navbar height
          isFullHeight ? 'overflow-hidden' : 'overflow-y-auto'
        )}>
          <div className={clsx(
            'flex-1 flex flex-col',
            isFullHeight ? 'overflow-hidden' : 'p-6'
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/"           element={<Navigate to="/orgs" replace />} />
              <Route path="/orgs"       element={<Orgs />} />
              <Route path="/orgs/:orgId" element={<OrgDetail />} />
              <Route path="/assistant"  element={<Assistant />} />
              <Route path="/logs"       element={<Logs />} />
              <Route path="/settings"   element={<Settings />} />
              <Route path="*"           element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <OrgProvider>
        <AppRoutes />
      </OrgProvider>
    </AuthProvider>
  )
}
