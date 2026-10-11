import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { getToken, setToken } from './api'
import DriverDetail from './pages/DriverDetail'
import Drivers from './pages/Drivers'
import Login from './pages/Login'

function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  if (!getToken()) return <Navigate to="/login" replace />
  return (
    <>
      <header className="topbar">
        <Link to="/drivers" className="brand">
          <span className="brand-en">Vandi Ottunar</span>
          <span className="brand-ta">Admin</span>
        </Link>
        <button
          className="btn link light"
          onClick={() => {
            setToken(null)
            navigate('/login')
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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/drivers"
          element={
            <Shell>
              <Drivers />
            </Shell>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <Shell>
              <DriverDetail />
            </Shell>
          }
        />
        <Route path="*" element={<Navigate to="/drivers" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
