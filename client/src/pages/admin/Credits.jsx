import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import api from '../../lib/api';
import { brl, parseBRLToCents } from '../../lib/format';

export default function Credits() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await api.get('/admin/students');
    setStudents(data);
    setStudentId((prev) => prev || (data[0] ? String(data[0].id) : ''));
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const selected = students.find((s) => String(s.id) === studentId);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const cents = parseBRLToCents(amount);
    if (!studentId || Number.isNaN(cents) || cents <= 0) {
      setMsg({ type: 'err', text: 'Selecione o aluno e informe um valor válido' });
      return;
    }
    try {
      const { data } = await api.post('/admin/credits', {
        studentId: Number(studentId),
        amountCents: cents,
        note: note || null,
      });
      setMsg({ type: 'ok', text: `Crédito lançado. Novo saldo: ${brl(data.student.balanceCents)}` });
      setAmount('');
      setNote('');
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Falha ao lançar' });
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2">
          <Wallet className="w-8 h-8 text-emerald-400" />
          Lançar créditos
        </h1>
        <p className="text-slate-400 mt-1">
          Créditos pré-pagos aumentam o saldo do aluno. Podem ser lançados a qualquer dia — não é obrigatório
          todo dia 1º.
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="rounded-3xl glass-strong border border-emerald-500/25 p-6 space-y-4"
      >
        <div>
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
        {selected && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3 text-sm">
            <p className="text-emerald-200/90">Saldo atual: {brl(selected.balanceCents)}</p>
            <p className="text-slate-400 text-xs mt-1">Limite em uso: {brl(selected.limitUsedCents)}</p>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 uppercase">Valor (R$)</label>
          <input
            className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-3 text-lg font-display"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase">Observação (opcional)</label>
          <input
            className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {msg && (
          <p className={msg.type === 'ok' ? 'text-emerald-300 text-sm' : 'text-rose-300 text-sm'}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg"
        >
          Confirmar crédito
        </button>
      </motion.form>
    </div>
  );
}
