import { ToastProvider } from './components/Toast'
import { AuthProvider } from './context/AuthContext'
import AppRouter from './routes/AppRouter'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  )
}
