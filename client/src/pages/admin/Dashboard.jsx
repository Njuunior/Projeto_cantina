import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Wallet, AlertOctagon, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { brl } from '../../lib/format';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sales, zero, using, blocked] = await Promise.all([
          api.get('/admin/reports/total-sales'),
          api.get('/admin/reports/zero-balance'),
          api.get('/admin/reports/using-limit'),
          api.get('/admin/reports/limit-blocked'),
        ]);
        if (!cancelled) {
          setStats({
            totalSales: sales.data,
            zeroCount: zero.data.length,
            usingCount: using.data.length,
            blockedCount: blocked.data.length,
          });
        }
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      title: 'Vendas (todas)',
      value: stats ? brl(stats.totalSales.total_cents) : '—',
      sub: stats ? `${stats.totalSales.count} lançamentos` : '',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Saldo zerado',
      value: stats ? String(stats.zeroCount) : '—',
      sub: 'alunos',
      icon: Wallet,
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Usando limite',
      value: stats ? String(stats.usingCount) : '—',
      sub: 'com dívida no limite',
      icon: Users,
      color: 'from-violet-500 to-fuchsia-600',
    },
    {
      title: 'Limite estourado',
      value: stats ? String(stats.blockedCount) : '—',
      sub: 'bloqueados p/ novo consumo',
      icon: AlertOctagon,
      color: 'from-rose-500 to-red-600',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Painel</h1>
        <p className="text-slate-400 mt-1">Resumo financeiro e riscos operacionais</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl glass p-5 border border-white/10 overflow-hidden relative"
          >
            <div
              className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-30 bg-gradient-to-br ${c.color}`}
            />
            <c.icon className="w-8 h-8 text-white/80 mb-3" />
            <p className="text-slate-400 text-sm">{c.title}</p>
            <p className="font-display font-bold text-2xl text-white mt-1">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
