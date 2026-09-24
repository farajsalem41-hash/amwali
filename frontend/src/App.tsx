import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { DashboardLayout } from './components/layout/DashboardLayout';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import DashboardHome from './pages/dashboard/DashboardHome';
import PaymentRequests from './pages/dashboard/PaymentRequests';
import PaymentRequestDetail from './pages/dashboard/PaymentRequestDetail';
import Proofs from './pages/dashboard/Proofs';
import Customers from './pages/dashboard/Customers';
import BankAccounts from './pages/dashboard/BankAccounts';
import Invoices from './pages/dashboard/Invoices';
import InvoiceDetail from './pages/dashboard/InvoiceDetail';
import Products from './pages/dashboard/Products';
import Orders from './pages/dashboard/Orders';
import OrderDetail from './pages/dashboard/OrderDetail';
import Couriers from './pages/dashboard/Couriers';
import Branches from './pages/dashboard/Branches';
import Employees from './pages/dashboard/Employees';
const Reports = lazy(() => import('./pages/dashboard/Reports'));
import Notifications from './pages/dashboard/Notifications';
import AuditLogs from './pages/dashboard/AuditLogs';
import SubscriptionPage from './pages/dashboard/Subscription';
import Support from './pages/dashboard/Support';
import Settings from './pages/dashboard/Settings';
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
import PayPage from './pages/public/PayPage';
import CourierPage from './pages/public/CourierPage';
import { Skeleton } from './components/ui';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Guest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.isAdmin ? '/admin' : '/app'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense
            fallback={
              <div className="mx-auto max-w-5xl space-y-4 p-8">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pay/:token" element={<PayPage />} />
            <Route path="/courier/:token" element={<CourierPage />} />
            <Route path="/login" element={<Guest><Login /></Guest>} />
            <Route path="/register" element={<Guest><Register /></Guest>} />
            <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
            <Route path="/app" element={<Protected><DashboardLayout /></Protected>}>
              <Route index element={<DashboardHome />} />
              <Route path="requests" element={<PaymentRequests />} />
              <Route path="requests/:id" element={<PaymentRequestDetail />} />
              <Route path="proofs" element={<Proofs />} />
              <Route path="customers" element={<Customers />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="couriers" element={<Couriers />} />
              <Route path="branches" element={<Branches />} />
              <Route path="employees" element={<Employees />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="support" element={<Support />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/admin/*" element={<Protected><AdminPanel /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
