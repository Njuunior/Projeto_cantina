import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { login, isAuthed, ready } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || '/admin/dashboard';

  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(user, pass);
      nav(from, { replace: true });
    } catch {
      setErr('Usuário ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  if (ready && isAuthed) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="mesh-admin min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl glass-strong p-8 border border-violet-500/30 shadow-glow"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-gradient-admin">Administração</h1>
            <p className="text-slate-400 text-sm">Cantina escolar — acesso restrito</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Usuário</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Senha</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="••••••••"
            />
          </div>
          {err && <p className="text-rose-300 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="text-center text-slate-500 text-xs mt-6">
          Padrão após instalação: <span className="text-slate-400">admin / admin123</span>
        </p>
      </motion.div>
    </div>
  );
}
