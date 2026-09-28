import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { PatientSignupPage } from './features/auth/PatientSignupPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<PatientSignupPage />} />
          <Route
            path="/patient/*"
            element={<ProtectedRoute allow={['patient']}><div>Patient area</div></ProtectedRoute>}
          />
          <Route
            path="/doctor/*"
            element={<ProtectedRoute allow={['doctor']}><div>Doctor area</div></ProtectedRoute>}
          />
          <Route
            path="/front-desk/*"
            element={<ProtectedRoute allow={['front_desk']}><div>Front desk area</div></ProtectedRoute>}
          />
          <Route path="/" element={<div>Clinic Triage System</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
