import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { PatientSignupPage } from './features/auth/PatientSignupPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'
import { PatientHome } from './features/patient/PatientHome'
import { DoctorHome } from './features/doctor/DoctorHome'
import { FrontDeskHome } from './features/frontdesk/FrontDeskHome'

function SignOutButton() {
  const { signOut } = useAuth()
  return <button onClick={() => signOut()}>Sign out</button>
}

function PatientRoute() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <SignOutButton />
      <PatientHome patientId={user.id} />
    </>
  )
}

function DoctorRoute() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <SignOutButton />
      <DoctorHome doctorId={user.id} />
    </>
  )
}

function FrontDeskRoute() {
  return (
    <>
      <SignOutButton />
      <FrontDeskHome />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<PatientSignupPage />} />
          <Route
            path="/patient/*"
            element={<ProtectedRoute allow={['patient']}><PatientRoute /></ProtectedRoute>}
          />
          <Route
            path="/doctor/*"
            element={<ProtectedRoute allow={['doctor']}><DoctorRoute /></ProtectedRoute>}
          />
          <Route
            path="/front-desk/*"
            element={<ProtectedRoute allow={['front_desk']}><FrontDeskRoute /></ProtectedRoute>}
          />
          <Route path="/" element={<div>Clinic Triage System</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
