import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import BookingDetail from './admin/BookingDetail'
import Bookings from './admin/Bookings'
import Customers from './admin/Customers'
import DriverDetail from './admin/DriverDetail'
import Drivers from './admin/Drivers'
import Login from './admin/Login'
import { getToken, setToken } from './api'
import { LangProvider } from './i18n'
import CustomerRegister from './public/CustomerRegister'
import Dashboard from './public/Dashboard'
import DriverRegister from './public/DriverRegister'
import Home from './public/Home'
import LoginPage from './public/LoginPage'

function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  if (!getToken()) return <Navigate to="/admin/login" replace />
  return (
    <>
      <header className="topbar">
        <Link to="/admin/drivers" className="brand">
          <span className="brand-en">Vandi Ottunar</span>
          <span className="brand-ta">Admin</span>
        </Link>
        <nav className="admin-nav" aria-label="Admin">
          <NavLink to="/admin/drivers">Drivers</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/customers">Customers</NavLink>
        </nav>
        <button
          className="btn link light"
          onClick={() => {
            setToken(null)
            navigate('/admin/login')
          }}
        >
          Sign out
        </button>
      </header>
      {children}
    </>
  )
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          {/* Public site */}
          <Route path="/" element={<Home />} />
          <Route path="/register/driver" element={<DriverRegister />} />
          <Route path="/register/customer" element={<CustomerRegister />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Admin panel */}
          <Route path="/admin" element={<Navigate to="/admin/drivers" replace />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin/drivers"
            element={
              <AdminShell>
                <Drivers />
              </AdminShell>
            }
          />
          <Route
            path="/admin/drivers/:id"
            element={
              <AdminShell>
                <DriverDetail />
              </AdminShell>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <AdminShell>
                <Bookings />
              </AdminShell>
            }
          />
          <Route
            path="/admin/bookings/:id"
            element={
              <AdminShell>
                <BookingDetail />
              </AdminShell>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <AdminShell>
                <Customers />
              </AdminShell>
            }
          />

          {/* Old admin links */}
          <Route path="/drivers/*" element={<Navigate to="/admin/drivers" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  )
}
