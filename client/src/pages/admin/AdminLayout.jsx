import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Package,
  Wallet,
  Receipt,
  FileText,
  BarChart3,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const nav = [
  { to: '/admin/dashboard', label: 'Painel', icon: LayoutDashboard },
  { to: '/admin/students', label: 'Alunos', icon: Users },
  { to: '/admin/products', label: 'Produtos', icon: Package },
  { to: '/admin/credits', label: 'Créditos', icon: Wallet },
  { to: '/admin/limit-pay', label: 'Quitar limite', icon: Receipt },
  { to: '/admin/statement', label: 'Extrato', icon: FileText },
  { to: '/admin/reports', label: 'Relatórios', icon: BarChart3 },
];

export default function AdminLayout() {
  const { admin, ready, logout, isAuthed } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return (
      <div className="mesh-admin min-h-screen flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }

  return (
    <div className="mesh-admin min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-white/10 glass hidden md:flex flex-col">
        <div className="p-5 border-b border-white/10">
          <p className="font-display font-bold text-gradient-admin text-lg">Gestão</p>
          <p className="text-xs text-slate-500 truncate mt-1">{admin?.username}</p>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600/40 to-pink-600/30 text-white border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-200/90 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar à cantina
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b border-white/10 glass px-4 py-3 flex items-center justify-between">
          <span className="font-display font-semibold text-gradient-admin">Admin</span>
          <NavLink to="/" className="text-xs text-amber-200">
            Cantina
          </NavLink>
        </header>
        <div className="md:hidden overflow-x-auto border-b border-white/10 glass px-2 py-2 flex gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${
                  isActive ? 'bg-violet-600/50 text-white' : 'text-slate-400'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4 md:p-8 overflow-auto"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
