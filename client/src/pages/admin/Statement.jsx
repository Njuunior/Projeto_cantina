import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import api from '../../lib/api';
import { brl } from '../../lib/format';

function EntryRow({ e }) {
  const color =
    e.kind === 'credit_topup'
      ? 'text-emerald-300'
      : e.kind === 'consumption'
        ? 'text-slate-200'
        : 'text-sky-300';
  const date = new Date(e.at).toLocaleString('pt-BR');
  return (
    <div className="flex flex-wrap gap-2 justify-between items-start py-3 border-b border-white/5 text-sm">
      <div>
        <p className={`font-medium ${color}`}>{e.label}</p>
        <p className="text-xs text-slate-500">{date}</p>
        {e.kind === 'consumption' && (
          <p className="text-xs text-slate-500 mt-1">
            Saldo: {brl(e.paidFromBalanceCents)} · Limite: {brl(e.paidFromLimitCents)} ·{' '}
            {e.registeredBy === 'manual' ? 'Manual' : 'RFID'}
          </p>
        )}
        {e.note && <p className="text-xs text-slate-500 mt-1">{e.note}</p>}
      </div>
      <p className={`font-display font-bold ${e.amountCents < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
        {e.amountCents < 0 ? '-' : '+'}
        {brl(Math.abs(e.amountCents))}
      </p>
    </div>
  );
}

export default function Statement() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/students').then(({ data: d }) => {
      setStudents(d);
      setStudentId((prev) => prev || (d[0] ? String(d[0].id) : ''));
    });
  }, []);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    api.get(`/admin/students/${studentId}/statement`).then(({ data: d }) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2">
          <FileText className="w-8 h-8 text-cyan-400" />
          Extrato do aluno
        </h1>
        <p className="text-slate-400 mt-1">Créditos, consumos, uso de limite e quitações</p>
      </div>

      <div className="rounded-2xl glass border border-white/10 p-4">
        <label className="text-xs text-slate-400 uppercase">Aluno</label>
        <select
          className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-3"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.className}
            </option>
          ))}
        </select>
      </div>

      {data?.student && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl glass-strong border border-cyan-500/20 p-5 grid sm:grid-cols-3 gap-4 text-sm"
        >
          <div>
            <p className="text-slate-500 text-xs">Saldo</p>
            <p className="font-display font-bold text-xl text-emerald-300">
              {brl(data.student.balanceCents)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Limite usado</p>
            <p className="font-display font-bold text-xl text-violet-200">
              {brl(data.student.limitUsedCents)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Disponível no limite</p>
            <p className="font-display font-bold text-xl text-sky-200">
              {brl(data.student.limitAvailableCents)}
            </p>
          </div>
        </motion.div>
      )}

      <div className="rounded-3xl glass border border-white/10 p-6 min-h-[200px]">
        {data?.entries?.length ? (
          data.entries.map((e) => <EntryRow key={`${e.kind}-${e.id}`} e={e} />)
        ) : (
          <p className="text-slate-500 text-center py-12">Sem lançamentos.</p>
        )}
      </div>
    </div>
  );
}
