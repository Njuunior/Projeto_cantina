import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';

import {

  CreditCard,

  ScanLine,

  ShoppingBag,

  User,

  AlertTriangle,

  CheckCircle2,

  Sparkles,

  Plus,

  Minus,

  Trash2,

  ShoppingCart,

  Wifi,

  WifiOff,

} from 'lucide-react';

import api from '../lib/api';

import { brl } from '../lib/format';

import { useRfidReader } from '../hooks/useRfidReader';



function cartKey(p) {

  return String(p.id);

}



function normalizeUid(uid) {

  return String(uid || '').trim().replace(/\s+/g, '').toUpperCase();

}



export default function CantinaPage() {

  const [products, setProducts] = useState([]);

  const [student, setStudent] = useState(null);

  const [loadingStudent, setLoadingStudent] = useState(false);

  const [cart, setCart] = useState([]);

  const [lastResult, setLastResult] = useState(null);

  const [error, setError] = useState(null);

  const [busy, setBusy] = useState(false);

  const studentRef = useRef(null);

  studentRef.current = student;



  const loadProducts = useCallback(async () => {

    const { data } = await api.get('/canteen/products');

    setProducts(data);

  }, []);



  useEffect(() => {

    loadProducts().catch(() => setProducts([]));

  }, [loadProducts]);



  const cartTotalCents = useMemo(

    () => cart.reduce((s, l) => s + l.priceCents * l.quantity, 0),

    [cart]

  );



  const lookup = useCallback(async (uid) => {

    const u = normalizeUid(uid);

    if (!u) return;

    setLoadingStudent(true);

    setError(null);

    setLastResult(null);



    const current = studentRef.current;

    if (current?.rfidUid === u) {

      setLoadingStudent(false);

      return;

    }



    setCart([]);

    try {

      const { data } = await api.get(`/canteen/student-by-rfid/${encodeURIComponent(u)}`);

      setStudent(data);

    } catch (e) {

      setStudent(null);

      setError(e.response?.data?.error || 'Cartão não cadastrado');

    } finally {

      setLoadingStudent(false);

    }

  }, []);



  const onCardRead = useCallback(

    (uid) => {

      if (busy || loadingStudent) return;

      lookup(uid);

    },

    [busy, loadingStudent, lookup]

  );



  const rfidStatus = useRfidReader({ onCard: onCardRead, enabled: true });



  const addToCart = (p) => {

    if (!student) {

      setError('Aproxime o cartão RFID do aluno primeiro');

      return;

    }

    setError(null);

    setLastResult(null);

    setCart((prev) => {

      const id = cartKey(p);

      const idx = prev.findIndex((x) => cartKey(x) === id);

      if (idx >= 0) {

        const next = [...prev];

        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + 1) };

        return next;

      }

      return [...prev, { id: p.id, name: p.name, priceCents: p.priceCents, quantity: 1 }];

    });

  };



  const setLineQty = (productId, qty) => {

    const q = Math.max(0, Math.min(99, Number(qty) || 0));

    setCart((prev) => {

      if (q === 0) return prev.filter((l) => l.id !== productId);

      return prev.map((l) => (l.id === productId ? { ...l, quantity: q } : l));

    });

  };



  const removeLine = (productId) => {

    setCart((prev) => prev.filter((l) => l.id !== productId));

  };



  const clearCart = () => setCart([]);



  const confirmCheckout = async () => {

    if (!student) {

      setError('Aproxime o cartão RFID do aluno primeiro');

      return;

    }

    if (!cart.length) {

      setError('Adicione itens ao carrinho');

      return;

    }

    setBusy(true);

    setError(null);

    setLastResult(null);

    try {

      const { data } = await api.post('/canteen/checkout', {

        rfidUid: student.rfidUid,

        items: cart.map((l) => ({ productId: l.id, quantity: l.quantity })),

        registeredBy: 'rfid',

      });

      setLastResult(data);

      setCart([]);

      setStudent(null);

    } catch (e) {

      const msg = e.response?.data?.error || 'Falha ao finalizar compra';

      setError(msg);

      if (e.response?.data?.student) {

        setStudent(e.response.data.student);

      }

      if (e.response?.data?.code === 'LIMIT_EXCEEDED') {

        setLastResult({ blocked: true, details: e.response.data.details });

      }

    } finally {

      setBusy(false);

    }

  };



  const readerReady = rfidStatus.bridgeOnline && rfidStatus.connected;



  return (

    <div className="mesh-cantina min-h-screen relative overflow-hidden">

      <div className="absolute inset-0 pointer-events-none opacity-[0.07] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h60v60H0z\' fill=\'none\'/%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1.2\' fill=\'%23fff\'/%3E%3C/svg%3E')]" />



      <header className="relative z-10 border-b border-white/10 glass">

        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <motion.div

              animate={{ rotate: [0, 6, -6, 0] }}

              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}

              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-600 flex items-center justify-center shadow-glow"

            >

              <ShoppingBag className="w-6 h-6 text-white" />

            </motion.div>

            <div>

              <h1 className="font-display font-bold text-xl md:text-2xl text-gradient-cantina">

                Cantina Escolar

              </h1>

              <p className="text-slate-400 text-sm">Passe o cartão • monte o carrinho • confirme</p>

            </div>

          </div>

          <Link

            to="/admin"

            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-strong text-sm font-semibold text-amber-200 hover:bg-white/15 transition"

          >

            <Sparkles className="w-4 h-4" />

            Área gerencial

          </Link>

        </div>

      </header>



      <main className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col xl:flex-row gap-6 lg:gap-8 xl:items-start">

        <section className="w-full xl:w-[min(100%,22rem)] xl:shrink-0 space-y-5">

          <motion.div

            initial={{ opacity: 0, y: 16 }}

            animate={{ opacity: 1, y: 0 }}

            className="rounded-2xl lg:rounded-3xl glass p-5 sm:p-6 space-y-4"

          >

            <div className="flex items-center justify-between gap-3">

              <h2 className="font-display font-semibold text-lg flex items-center gap-2 text-cyan-200">

                <ScanLine className="w-5 h-5" />

                Leitor RFID

              </h2>

              <span

                className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${

                  readerReady

                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'

                    : 'bg-rose-500/10 border-rose-400/30 text-rose-200'

                }`}

              >

                {readerReady ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}

                {readerReady ? 'Pronto' : 'Offline'}

              </span>

            </div>



            <div

              className={`rounded-2xl border p-5 text-center space-y-3 ${

                loadingStudent

                  ? 'border-cyan-400/50 bg-cyan-500/10'

                  : student

                    ? 'border-fuchsia-400/40 bg-fuchsia-500/10'

                    : readerReady

                      ? 'border-cyan-500/30 bg-black/25'

                      : 'border-rose-500/30 bg-rose-950/20'

              }`}

            >

              {loadingStudent ? (

                <>

                  <motion.div

                    animate={{ scale: [1, 1.08, 1] }}

                    transition={{ repeat: Infinity, duration: 1.2 }}

                    className="mx-auto w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center"

                  >

                    <ScanLine className="w-8 h-8 text-cyan-300" />

                  </motion.div>

                  <p className="text-cyan-100 font-medium">Identificando aluno...</p>

                </>

              ) : student ? (

                <>

                  <CheckCircle2 className="w-10 h-10 text-fuchsia-300 mx-auto" />

                  <p className="text-fuchsia-100 font-medium">Aluno selecionado</p>

                  <p className="text-slate-400 text-xs">Adicione os itens ao carrinho</p>

                </>

              ) : readerReady ? (

                <>

                  <motion.div

                    animate={{ opacity: [0.5, 1, 0.5] }}

                    transition={{ repeat: Infinity, duration: 2 }}

                    className="mx-auto w-16 h-16 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-400/30"

                  >

                    <CreditCard className="w-8 h-8 text-cyan-300" />

                  </motion.div>

                  <p className="text-white font-medium">Aproxime o cartão do aluno</p>

                  <p className="text-slate-500 text-xs">O aluno será selecionado automaticamente</p>

                </>

              ) : (

                <>

                  <WifiOff className="w-10 h-10 text-rose-300 mx-auto" />

                  <p className="text-rose-100 font-medium">Leitor não disponível</p>

                  <p className="text-slate-500 text-xs">

                    Inicie o bridge RFID: <code className="text-cyan-300">npm run dev:rfid</code>

                  </p>

                </>

              )}

            </div>



            {rfidStatus.reader && (

              <p className="text-slate-500 text-xs text-center font-mono truncate">{rfidStatus.reader}</p>

            )}



            {error && (

              <p className="text-rose-300 text-sm flex items-center gap-2">

                <AlertTriangle className="w-4 h-4 shrink-0" />

                {error}

              </p>

            )}

          </motion.div>



          <AnimatePresence mode="wait">

            {student && (

              <motion.div

                key={student.id}

                initial={{ opacity: 0, scale: 0.96 }}

                animate={{ opacity: 1, scale: 1 }}

                exit={{ opacity: 0 }}

                className="rounded-2xl lg:rounded-3xl glass-strong p-5 sm:p-6 space-y-4 border border-fuchsia-500/20"

              >

                <div className="flex items-start gap-3">

                  {student.photoUrl ? (

                    <img

                      src={student.photoUrl}

                      alt=""

                      className="w-14 h-14 rounded-2xl object-cover border-2 border-fuchsia-400/40 shadow-glow2 shrink-0"

                    />

                  ) : (

                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center shadow-glow2 shrink-0">

                      <User className="w-7 h-7 text-white" />

                    </div>

                  )}

                  <div>

                    <h3 className="font-display font-bold text-xl text-white">{student.name}</h3>

                    <p className="text-slate-400 text-sm">{student.className}</p>

                    <p className="text-slate-500 text-xs mt-1">Resp.: {student.guardianName}</p>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">

                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3">

                    <p className="text-emerald-200/80 text-xs">Saldo</p>

                    <p className="font-display font-bold text-lg text-emerald-300">

                      {brl(student.balanceCents)}

                    </p>

                  </div>

                  <div className="rounded-2xl bg-violet-500/10 border border-violet-400/30 p-3">

                    <p className="text-violet-200/80 text-xs">Limite usado</p>

                    <p className="font-display font-bold text-lg text-violet-200">

                      {brl(student.limitUsedCents)}

                    </p>

                  </div>

                  <div className="rounded-2xl bg-sky-500/10 border border-sky-400/25 p-3 col-span-2">

                    <p className="text-sky-200/80 text-xs">Disponível no limite</p>

                    <p className="font-display font-bold text-lg text-sky-200">

                      {brl(student.limitAvailableCents)} / teto {brl(student.creditLimitMaxCents)}

                    </p>

                  </div>

                </div>

                {student.limitNearExhausted && !student.limitFullyUsed && (

                  <p className="text-amber-200 text-xs flex items-center gap-2 bg-amber-500/10 rounded-xl px-3 py-2 border border-amber-400/30">

                    <AlertTriangle className="w-4 h-4" />

                    Limite quase esgotado — avise a família.

                  </p>

                )}

                {student.limitFullyUsed && (

                  <p className="text-rose-200 text-xs flex items-center gap-2 bg-rose-500/10 rounded-xl px-3 py-2 border border-rose-400/30">

                    <AlertTriangle className="w-4 h-4" />

                    Limite total usado — só após quitação na administração.

                  </p>

                )}

              </motion.div>

            )}

          </AnimatePresence>



          <AnimatePresence>

            {lastResult && !lastResult.blocked && (

              <motion.div

                initial={{ opacity: 0, y: 8 }}

                animate={{ opacity: 1, y: 0 }}

                className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-4 space-y-2"

              >

                <p className="font-semibold text-emerald-200 flex items-center gap-2">

                  <CheckCircle2 className="w-5 h-5" />

                  Compra confirmada

                </p>

                {lastResult.lines?.length ? (

                  <ul className="text-sm text-slate-200 space-y-1">

                    {lastResult.lines.map((l) => (

                      <li key={`${l.productId}-${l.quantity}`}>

                        {l.productName} × {l.quantity} — {brl(l.totalCents)}

                      </li>

                    ))}

                  </ul>

                ) : lastResult.product ? (

                  <p className="text-sm text-slate-200">

                    {lastResult.product.name} — {brl(lastResult.product.priceCents)}

                  </p>

                ) : null}

                {lastResult.totalCents != null && (

                  <p className="text-emerald-100 font-display font-bold">

                    Total: {brl(lastResult.totalCents)}

                  </p>

                )}

                {lastResult.alerts?.map((a) => (

                  <p key={a.type} className="text-xs text-amber-100 flex items-center gap-2">

                    <CreditCard className="w-3.5 h-3.5" />

                    {a.message}

                  </p>

                ))}

                <p className="text-[11px] text-emerald-200/70">

                  Passe o próximo cartão para atender outro aluno.

                </p>

              </motion.div>

            )}

            {lastResult?.blocked && (

              <motion.div

                initial={{ opacity: 0, scale: 0.98 }}

                animate={{ opacity: 1, scale: 1 }}

                className="rounded-3xl border border-rose-500/50 bg-rose-950/40 p-4"

              >

                <p className="font-semibold text-rose-200 flex items-center gap-2">

                  <AlertTriangle className="w-5 h-5" />

                  Compra bloqueada

                </p>

                <p className="text-sm text-rose-100/90 mt-2">

                  Limite insuficiente para o valor total do carrinho. Necessário no limite:{' '}

                  {brl(lastResult.details?.neededFromLimitCents)} — disponível:{' '}

                  {brl(lastResult.details?.availableLimitCents)}.

                </p>

              </motion.div>

            )}

          </AnimatePresence>

        </section>



        <section className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

            <motion.div

              initial={{ opacity: 0, y: 12 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.05 }}

              className="flex-1 min-w-0 w-full rounded-2xl lg:rounded-3xl glass p-5 sm:p-6 lg:p-8"

            >

              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">

                <div>

                  <h2 className="font-display font-semibold text-xl md:text-2xl text-amber-200 flex items-center gap-2">

                    <ShoppingBag className="w-6 h-6 shrink-0" />

                    Produtos

                  </h2>

                  <p className="text-slate-500 text-sm mt-1 max-w-2xl">

                    Toque no card para adicionar. A cobrança só ocorre ao confirmar o carrinho.

                  </p>

                </div>

                <span className="text-xs text-slate-500 font-mono bg-black/25 px-3 py-1.5 rounded-full border border-white/10">

                  {products.length} itens

                </span>

              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">

                {products.map((p, i) => (

                  <motion.button

                    key={p.id}

                    type="button"

                    disabled={busy || !student}

                    initial={{ opacity: 0, y: 10 }}

                    animate={{ opacity: 1, y: 0 }}

                    transition={{ delay: Math.min(i * 0.02, 0.25) }}

                    onClick={() => addToCart(p)}

                    className="text-left rounded-2xl p-4 sm:p-5 min-h-[100px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:border-cyan-400/50 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition group flex flex-col justify-between gap-3"

                  >

                    <p className="font-semibold text-white text-sm sm:text-base leading-snug line-clamp-3 group-hover:text-cyan-100">

                      {p.name}

                    </p>

                    <div className="flex items-center justify-between gap-2 mt-auto">

                      <p className="text-fuchsia-300 font-display font-bold text-base sm:text-lg">

                        {brl(p.priceCents)}

                      </p>

                      <span className="shrink-0 w-10 h-10 rounded-xl bg-cyan-500/25 border border-cyan-400/35 flex items-center justify-center text-cyan-100">

                        <Plus className="w-5 h-5" />

                      </span>

                    </div>

                  </motion.button>

                ))}

              </div>

              {!student && (

                <p className="text-center text-slate-500 text-sm mt-8 py-6 border border-dashed border-white/15 rounded-2xl">

                  Aproxime o cartão RFID do aluno para habilitar os produtos.

                </p>

              )}

            </motion.div>



            <motion.div

              initial={{ opacity: 0, y: 12 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.08 }}

              className="w-full lg:w-[min(100%,24rem)] shrink-0 rounded-2xl lg:rounded-3xl glass-strong p-5 sm:p-6 border border-amber-400/25 lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)] flex flex-col"

            >

              <div className="shrink-0">

                <h2 className="font-display font-semibold text-lg mb-1 text-amber-100 flex items-center gap-2">

                  <ShoppingCart className="w-5 h-5" />

                  Carrinho

                </h2>

                <p className="text-slate-500 text-xs mb-4">

                  Revise e confirme para registrar e avisar o responsável.

                </p>

              </div>



              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 max-h-[min(45vh,400px)] lg:max-h-none">

                {!cart.length ? (

                  <p className="text-slate-500 text-sm py-10 text-center border border-dashed border-white/10 rounded-2xl">

                    Carrinho vazio. Toque nos produtos à esquerda.

                  </p>

                ) : (

                  <ul className="space-y-3">

                    {cart.map((l) => (

                      <li

                        key={l.id}

                        className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 flex flex-col gap-2"

                      >

                        <div className="flex justify-between gap-2">

                          <p className="font-medium text-white text-sm leading-snug">{l.name}</p>

                          <p className="text-fuchsia-300 font-display font-semibold text-sm shrink-0">

                            {brl(l.priceCents * l.quantity)}

                          </p>

                        </div>

                        <div className="flex items-center justify-between gap-2">

                          <div className="flex items-center gap-1">

                            <button

                              type="button"

                              disabled={busy}

                              onClick={() => setLineQty(l.id, l.quantity - 1)}

                              className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-40"

                              aria-label="Diminuir"

                            >

                              <Minus className="w-4 h-4" />

                            </button>

                            <span className="w-8 text-center text-sm font-semibold text-white">{l.quantity}</span>

                            <button

                              type="button"

                              disabled={busy}

                              onClick={() => setLineQty(l.id, l.quantity + 1)}

                              className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-40"

                              aria-label="Aumentar"

                            >

                              <Plus className="w-4 h-4" />

                            </button>

                          </div>

                          <button

                            type="button"

                            disabled={busy}

                            onClick={() => removeLine(l.id)}

                            className="text-xs text-rose-300 inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10"

                          >

                            <Trash2 className="w-3.5 h-3.5" />

                            Remover

                          </button>

                        </div>

                      </li>

                    ))}

                  </ul>

                )}

              </div>



              <div className="shrink-0 mt-4 pt-4 border-t border-white/10 flex items-center justify-between">

                <span className="text-slate-400 text-sm">Subtotal</span>

                <span className="font-display font-bold text-xl text-white">{brl(cartTotalCents)}</span>

              </div>



              <div className="shrink-0 mt-4 flex flex-col sm:flex-row gap-2">

                <button

                  type="button"

                  disabled={busy || !cart.length || !student}

                  onClick={confirmCheckout}

                  className="flex-1 btn-shine rounded-2xl py-3 font-bold bg-gradient-to-r from-amber-500 to-pink-600 text-white disabled:opacity-40"

                >

                  {busy ? 'Registrando...' : 'Confirmar compra'}

                </button>

                <button

                  type="button"

                  disabled={busy || !cart.length}

                  onClick={clearCart}

                  className="px-4 rounded-2xl border border-white/15 text-slate-300 hover:bg-white/5 text-sm"

                >

                  Limpar

                </button>

              </div>

            </motion.div>

        </section>

      </main>

    </div>

  );

}


