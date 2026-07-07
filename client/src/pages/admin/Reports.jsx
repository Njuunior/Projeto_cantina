import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import { brl } from '../../lib/format';

export default function Reports() {
  const [consumption, setConsumption] = useState([]);
  const [zero, setZero] = useState([]);
  const [using, setUsing] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [sales, setSales] = useState(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [a, b, d, e, f] = await Promise.all([
          api.get('/admin/reports/consumption-by-student'),
          api.get('/admin/reports/zero-balance'),
          api.get('/admin/reports/using-limit'),
          api.get('/admin/reports/limit-blocked'),
          api.get('/admin/reports/total-sales'),
        ]);
        if (c) return;
        setConsumption(a.data);
        setZero(b.data);
        setUsing(d.data);
        setBlocked(e.data);
        setSales(f.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const Section = ({ title, subtitle, children, gradient }) => (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl glass border p-6 ${gradient}`}
    >
      <h2 className="font-display font-bold text-xl text-white">{title}</h2>
      <p className="text-slate-400 text-sm mb-4">{subtitle}</p>
      {children}
    </motion.section>
  );

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Relatórios</h1>
        <p className="text-slate-400 mt-1">Consumo, saldos e situação do limite</p>
      </div>

      {sales && (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-900/40 to-teal-900/30 border border-emerald-500/30 p-6 flex flex-wrap gap-6 items-center justify-between">
          <div>
            <p className="text-emerald-200/80 text-sm">Total vendido na cantina (histórico)</p>
            <p className="font-display font-bold text-4xl text-white mt-1">{brl(sales.total_cents)}</p>
          </div>
          <p className="text-slate-400 text-sm">{sales.count} registros de consumo</p>
        </div>
      )}

      <Section
        title="Consumo por aluno"
        subtitle="Soma de todos os consumos registrados"
        gradient="border-fuchsia-500/20"
      >
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 sticky top-0 bg-slate-950/90">
              <tr>
                <th className="text-left py-2">Aluno</th>
                <th className="text-left py-2">Turma</th>
                <th className="text-right py-2">Total</th>
                <th className="text-right py-2">Compras</th>
              </tr>
            </thead>
            <tbody>
              {consumption.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2 text-white">{r.name}</td>
                  <td className="py-2 text-slate-400">{r.class_name}</td>
                  <td className="py-2 text-right text-fuchsia-300 font-medium">
                    {brl(r.total_spent_cents)}
                  </td>
                  <td className="py-2 text-right text-slate-400">{r.purchase_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid md:grid-cols-3 gap-4">
        <Section title="Saldo zerado" subtitle="Alunos sem saldo pré-pago" gradient="border-amber-500/25">
          <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {zero.map((s) => (
              <li key={s.id} className="text-amber-100/90">
                {s.name} <span className="text-slate-500">({s.className})</span>
              </li>
            ))}
            {!zero.length && <li className="text-slate-500">Nenhum</li>}
          </ul>
        </Section>
        <Section title="Usando limite" subtitle="Com dívida no limite" gradient="border-violet-500/25">
          <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {using.map((s) => (
              <li key={s.id} className="text-violet-200">
                {s.name}{' '}
                <span className="text-slate-500">
                  — {brl(s.limitUsedCents)} / {brl(s.creditLimitMaxCents)}
                </span>
              </li>
            ))}
            {!using.length && <li className="text-slate-500">Nenhum</li>}
          </ul>
        </Section>
        <Section
          title="Limite estourado"
          subtitle="Bloqueados para novo consumo no limite"
          gradient="border-rose-500/25"
        >
          <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {blocked.map((s) => (
              <li key={s.id} className="text-rose-200">
                {s.name}{' '}
                <span className="text-slate-500">({s.className})</span>
              </li>
            ))}
            {!blocked.length && <li className="text-slate-500">Nenhum</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
