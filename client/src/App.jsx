import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import CantinaPage from './pages/CantinaPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Students from './pages/admin/Students';
import Products from './pages/admin/Products';
import Credits from './pages/admin/Credits';
import LimitPay from './pages/admin/LimitPay';
import Statement from './pages/admin/Statement';
import Reports from './pages/admin/Reports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<CantinaPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="products" element={<Products />} />
            <Route path="credits" element={<Credits />} />
            <Route path="limit-pay" element={<LimitPay />} />
            <Route path="statement" element={<Statement />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
