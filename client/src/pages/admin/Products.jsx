import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import api from '../../lib/api';
import { brl, parseBRLToCents } from '../../lib/format';

export default function Products() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/products');
    setList(data);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const toggle = async (p) => {
    await api.patch(`/admin/products/${p.id}`, { active: !p.active });
    await load();
  };

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    const cents = parseBRLToCents(price);
    if (!name.trim() || Number.isNaN(cents) || cents <= 0) {
      setErr('Nome e preço válidos obrigatórios');
      return;
    }
    try {
      await api.post('/admin/products', { name: name.trim(), priceCents: cents });
      setModal(false);
      setName('');
      setPrice('');
      await load();
    } catch (er) {
      setErr(er.response?.data?.error || 'Erro');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-center">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Produtos</h1>
          <p className="text-slate-400 text-sm">Preços exibidos na operação da cantina</p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo produto
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`rounded-2xl glass p-4 border flex justify-between items-center ${
              p.active ? 'border-emerald-500/30' : 'border-white/5 opacity-60'
            }`}
          >
            <div>
              <p className="font-semibold text-white">{p.name}</p>
              <p className="text-fuchsia-300 font-display font-bold">{brl(p.priceCents)}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(p)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                p.active
                  ? 'border-rose-400/40 text-rose-200'
                  : 'border-emerald-400/40 text-emerald-200'
              }`}
            >
              {p.active ? 'Desativar' : 'Ativar'}
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onSubmit={save}
              className="w-full max-w-md rounded-2xl glass-strong border border-amber-500/30 p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display font-bold text-lg">Novo produto</h2>
                <button type="button" onClick={() => setModal(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                placeholder="Preço (ex: 4,50)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              {err && <p className="text-rose-300 text-sm">{err}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-orange-600"
              >
                Salvar
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
