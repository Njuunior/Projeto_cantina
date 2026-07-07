import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt } from 'lucide-react';
import api from '../../lib/api';
import { brl, parseBRLToCents } from '../../lib/format';

export default function LimitPay() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await api.get('/admin/students');
    setStudents(data);
    setStudentId((prev) => {
      if (prev) return prev;
      const withDebt = data.find((s) => s.limitUsedCents > 0);
      if (withDebt) return String(withDebt.id);
      return data[0] ? String(data[0].id) : '';
    });
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
      setMsg({ type: 'err', text: 'Valor inválido' });
      return;
    }
    try {
      const { data } = await api.post('/admin/limit-payments', {
        studentId: Number(studentId),
        amountCents: cents,
        note: note || null,
      });
      setMsg({
        type: 'ok',
        text: `Pagamento registrado. Dívida restante no limite: ${brl(data.student.limitUsedCents)}`,
      });
      setAmount('');
      setNote('');
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Falha' });
    }
  };

  const payFull = () => {
    if (selected?.limitUsedCents) {
      setAmount((selected.limitUsedCents / 100).toFixed(2).replace('.', ','));
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2">
          <Receipt className="w-8 h-8 text-violet-400" />
          Quitar débito / limite
        </h1>
        <p className="text-slate-400 mt-1">
          O pagamento <strong className="text-amber-200">não vira saldo</strong> — apenas reduz a dívida
          registrada no limite. O aluno só recupera capacidade de consumo no limite após quitar.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl glass-strong border border-violet-500/30 p-6 space-y-4"
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
                {s.name} — deve {brl(s.limitUsedCents)}
              </option>
            ))}
          </select>
        </div>
        {selected && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-violet-500/15 border border-violet-400/25 p-4">
              <p className="text-slate-400 text-xs">Dívida no limite</p>
              <p className="font-display font-bold text-2xl text-violet-200">
                {brl(selected.limitUsedCents)}
              </p>
            </div>
            <div className="rounded-xl bg-sky-500/10 border border-sky-400/20 p-4">
              <p className="text-slate-400 text-xs">Disponível p/ usar</p>
              <p className="font-display font-bold text-2xl text-sky-200">
                {brl(selected.limitAvailableCents)}
              </p>
            </div>
            <div className="col-span-2 rounded-xl bg-white/5 p-3 flex justify-between items-center">
              <span className="text-slate-400 text-xs">Teto do limite</span>
              <span className="text-white font-medium">{brl(selected.creditLimitMaxCents)}</span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-slate-400 uppercase">Valor pago (R$)</label>
            <input
              className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-3 text-lg font-display"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
            <button
              type="button"
              onClick={payFull}
              className="mt-2 text-xs text-amber-300 hover:underline"
            >
              Preencher valor total da dívida
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Observação</label>
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
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600"
          >
            Registrar pagamento
          </button>
        </form>
      </motion.div>
    </div>
  );
}
