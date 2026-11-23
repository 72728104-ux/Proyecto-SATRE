import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout() {
  const { role, collegeHasResidence } = useAuth()
  const [open, setOpen] = useState(false)
  const [outletKey, setOutletKey] = useState(0)

  return (
    <div className="min-h-svh bg-slate-50 text-slate-800 lg:flex">
      <Sidebar role={role} collegeHasResidence={collegeHasResidence} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 lg:p-8">
          <ErrorBoundary key={outletKey} onReset={() => setOutletKey((n) => n + 1)}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
