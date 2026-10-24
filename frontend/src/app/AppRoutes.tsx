import { Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from '../auth/AuthProvider';
import { RedirectIfSignedIn, RequireAuth } from '../auth/guards';
import { LoginPage } from '../auth/LoginPage';
import { RegisterPage } from '../auth/RegisterPage';
import { DashboardPage } from '../dashboard/DashboardPage';

export function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfSignedIn>
              <LoginPage />
            </RedirectIfSignedIn>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfSignedIn>
              <RegisterPage />
            </RedirectIfSignedIn>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
