import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, X, Camera, Users, Edit3, ScanLine, CreditCard, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { brl, parseBRLToCents } from '../../lib/format';
import { useRfidReader } from '../../hooks/useRfidReader';

const DEFAULT_CLASSES = ['1º A', '1º B', '1º C', '2º A', '2º B', '2º C', '3º A', '3º B', '3º C'];

function StudentAvatar({ name, photoUrl }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 border border-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
      {initial}
    </div>
  );
}

export default function Students() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null); // 'new' | 'edit'
  const [form, setForm] = useState({
    name: '',
    className: '',
    guardianName: '',
    guardianRelationship: '',
    guardianDocument: '',
    guardianContact: '',
    guardianWhatsapp: '',
    whatsappOptIn: true,
    rfidUid: '',
    balanceBRL: '',
    limitMaxBRL: '50',
  });
  const [classOptions, setClassOptions] = useState(DEFAULT_CLASSES);
  const [editingId, setEditingId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [limitEdit, setLimitEdit] = useState({ id: null, value: '' });
  const [msg, setMsg] = useState('');
  const [rfidCaptured, setRfidCaptured] = useState(false);
  const photoInputRefs = useRef({});

  const onRfidForForm = useCallback((uid) => {
    const normalized = String(uid || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!normalized) return;
    setForm((f) => ({ ...f, rfidUid: normalized }));
    setRfidCaptured(true);
    setMsg('');
  }, []);

  const rfidStatus = useRfidReader({
    onCard: onRfidForForm,
    enabled: modal === 'new' || modal === 'edit',
  });

  const byClass = useMemo(() => {
    const map = new Map();
    for (const s of list) {
      const key = s.className?.trim() || 'Sem turma';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [list]);

  const load = useCallback(async () => {
    const [students, classes] = await Promise.all([
      api.get('/admin/students'),
      api.get('/admin/class-options').catch(() => ({ data: DEFAULT_CLASSES })),
    ]);
    setList(students.data);
    setClassOptions(classes.data?.length ? classes.data : DEFAULT_CLASSES);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const openNew = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setForm({
      name: '',
      className: classOptions[0] || '1º A',
      guardianName: '',
      guardianRelationship: '',
      guardianDocument: '',
      guardianContact: '',
      guardianWhatsapp: '',
      whatsappOptIn: true,
      rfidUid: '',
      balanceBRL: '',
      limitMaxBRL: '50',
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditingId(null);
    setRfidCaptured(false);
    setModal('new');
    setMsg('');
  };

  const openEdit = (s) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setForm({
      name: s.name || '',
      className: s.className || classOptions[0] || '1º A',
      guardianName: s.guardianName || '',
      guardianRelationship: s.guardianRelationship || '',
      guardianDocument: s.guardianDocument || '',
      guardianContact: s.guardianContact || '',
      guardianWhatsapp: s.guardianWhatsapp || '',
      whatsappOptIn: s.whatsappOptIn !== false,
      rfidUid: s.rfidUid || '',
      balanceBRL: '',
      limitMaxBRL: String((s.creditLimitMaxCents / 100).toFixed(2)).replace('.', ','),
    });
    setEditingId(s.id);
    setPhotoFile(null);
    setPhotoPreview(s.photoUrl || null);
    setRfidCaptured(!!s.rfidUid);
    setModal('edit');
    setMsg('');
  };

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(f || null);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
    e.target.value = '';
  };

  const saveNew = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!form.rfidUid.trim()) {
      setMsg('Aproxime o cartão RFID do aluno para cadastrar');
      return;
    }
    const lim = parseBRLToCents(form.limitMaxBRL);
    const bal = form.balanceBRL ? parseBRLToCents(form.balanceBRL) : 0;
    if (Number.isNaN(lim) || lim < 0) {
      setMsg('Limite inválido');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('className', form.className.trim());
      fd.append('guardianName', form.guardianName.trim());
      fd.append('guardianRelationship', form.guardianRelationship.trim());
      fd.append('guardianDocument', form.guardianDocument.trim());
      fd.append('guardianContact', form.guardianContact.trim());
      fd.append('guardianWhatsapp', form.guardianWhatsapp.trim());
      fd.append('whatsappOptIn', String(!!form.whatsappOptIn));
      fd.append('rfidUid', form.rfidUid.trim());
      fd.append('balanceCents', String(Number.isNaN(bal) || bal < 0 ? 0 : bal));
      fd.append('creditLimitMaxCents', String(lim));
      if (photoFile) fd.append('photo', photoFile);
      await api.post('/admin/students', fd);
      setModal(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Erro ao salvar');
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!form.rfidUid.trim()) {
      setMsg('O aluno precisa ter um cartão RFID associado');
      return;
    }
    const lim = parseBRLToCents(form.limitMaxBRL);
    if (Number.isNaN(lim) || lim < 0) {
      setMsg('Limite inválido');
      return;
    }
    try {
      await api.patch(`/admin/students/${editingId}`, {
        name: form.name.trim(),
        className: form.className.trim(),
        guardianName: form.guardianName.trim(),
        guardianRelationship: form.guardianRelationship.trim(),
        guardianDocument: form.guardianDocument.trim(),
        guardianContact: form.guardianContact.trim(),
        guardianWhatsapp: form.guardianWhatsapp.trim(),
        whatsappOptIn: !!form.whatsappOptIn,
        rfidUid: form.rfidUid.trim(),
      });
      await api.patch(`/admin/students/${editingId}/limit-max`, { creditLimitMaxCents: lim });
      if (photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        await api.patch(`/admin/students/${editingId}/photo`, fd);
      }
      setModal(null);
      setEditingId(null);
      setPhotoFile(null);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Erro ao atualizar');
    }
  };

  const saveLimit = async (id) => {
    const cents = parseBRLToCents(limitEdit.value);
    if (Number.isNaN(cents) || cents < 0) return;
    try {
      await api.patch(`/admin/students/${id}/limit-max`, { creditLimitMaxCents: cents });
      setLimitEdit({ id: null, value: '' });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro');
    }
  };

  const onRowPhoto = async (studentId, e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('photo', f);
    try {
      await api.patch(`/admin/students/${studentId}/photo`, fd);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Não foi possível enviar a foto');
    }
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2">
            <Users className="w-8 h-8 text-violet-400" />
            Alunos
          </h1>
          <p className="text-slate-400 text-sm">
            Agrupados por turma · saldo oculto nesta tela (consulte Créditos / Extrato)
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo aluno
        </button>
      </div>

      {byClass.map(([turma, alunos]) => (
        <motion.section
          key={turma}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl glass border border-white/10 overflow-hidden"
        >
          <div className="px-4 py-3 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 border-b border-white/10 flex items-center gap-2">
            <span className="font-display font-bold text-lg text-white">{turma}</span>
            <span className="text-xs text-slate-400">({alunos.length} aluno{alunos.length !== 1 ? 's' : ''})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-400 text-left">
                <tr>
                  <th className="p-3 font-medium w-12" aria-label="Foto">
                    <span className="sr-only">Foto</span>
                  </th>
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">RFID</th>
                  <th className="p-3 font-medium">Responsável</th>
                  <th className="p-3 font-medium">Limite usado</th>
                  <th className="p-3 font-medium">Teto limite</th>
                  <th className="p-3 font-medium w-28">Atualizar foto</th>
                  <th className="p-3 font-medium w-24">Editar</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((s) => (
                  <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="p-3">
                      <StudentAvatar name={s.name} photoUrl={s.photoUrl} />
                    </td>
                    <td className="p-3">
                      <p className="text-white font-medium">{s.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Resp.: {s.guardianName}</p>
                    </td>
                    <td className="p-3 text-cyan-300/90 font-mono text-xs">{s.rfidUid}</td>
                    <td className="p-3 text-xs">
                      <p className="text-slate-200">{s.guardianName}</p>
                      <p className="text-slate-500">
                        {s.guardianRelationship} · {s.guardianDocument}
                      </p>
                      <p className="text-slate-500">{s.guardianContact}</p>
                    </td>
                    <td className="p-3 text-violet-200">{brl(s.limitUsedCents)}</td>
                    <td className="p-3">
                      {limitEdit.id === s.id ? (
                        <span className="flex items-center gap-2">
                          <input
                            className="w-24 rounded-lg bg-black/40 border border-white/15 px-2 py-1 text-xs"
                            value={limitEdit.value}
                            onChange={(e) => setLimitEdit({ id: s.id, value: e.target.value })}
                          />
                          <button
                            type="button"
                            className="text-xs text-emerald-300"
                            onClick={() => saveLimit(s.id)}
                          >
                            OK
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setLimitEdit({
                              id: s.id,
                              value: String((s.creditLimitMaxCents / 100).toFixed(2)).replace('.', ','),
                            })
                          }
                          className="inline-flex items-center gap-1 text-amber-200/90 hover:underline"
                        >
                          {brl(s.creditLimitMaxCents)}
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        ref={(el) => {
                          photoInputRefs.current[s.id] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(ev) => onRowPhoto(s.id, ev)}
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRefs.current[s.id]?.click()}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
                        title="Alterar foto"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Enviar
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-violet-400/30 text-violet-200 hover:bg-violet-500/20"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      ))}

      {!list.length && (
        <p className="text-slate-500 text-center py-12">Nenhum aluno cadastrado.</p>
      )}

      <AnimatePresence>
        {(modal === 'new' || modal === 'edit') && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={modal === 'new' ? saveNew : saveEdit}
              className="w-full max-w-lg rounded-2xl glass-strong border border-violet-500/30 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display font-bold text-xl text-white">
                  {modal === 'new' ? 'Novo aluno' : 'Editar aluno'}
                </h2>
                <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex flex-col items-center gap-2">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt=""
                      className="w-28 h-28 rounded-2xl object-cover border border-white/20"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl border border-dashed border-white/20 flex items-center justify-center text-slate-500 text-xs text-center px-2">
                      Sem foto
                    </div>
                  )}
                  <label className="cursor-pointer text-xs text-cyan-300 hover:underline">
                    Escolher imagem
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onPickPhoto} />
                  </label>
                  <p className="text-[10px] text-slate-500 text-center">JPEG, PNG, GIF ou WebP · até 5 MB</p>
                </div>

                <div className="grid gap-3 flex-1 w-full">
                  <input
                    required
                    placeholder="Nome completo"
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <label className="text-xs text-slate-400">Turma</label>
                  <select
                    required
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                    value={form.className}
                    onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  >
                    {classOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    placeholder="Nome completo do responsável"
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                    value={form.guardianName}
                    onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Grau de parentesco"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.guardianRelationship}
                      onChange={(e) => setForm((f) => ({ ...f, guardianRelationship: e.target.value }))}
                    />
                    <input
                      required
                      placeholder="RG ou CPF do responsável"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.guardianDocument}
                      onChange={(e) => setForm((f) => ({ ...f, guardianDocument: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Contato do responsável"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.guardianContact}
                      onChange={(e) => setForm((f) => ({ ...f, guardianContact: e.target.value }))}
                    />
                    <input
                      placeholder="WhatsApp (se diferente)"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.guardianWhatsapp}
                      onChange={(e) => setForm((f) => ({ ...f, guardianWhatsapp: e.target.value }))}
                    />
                  </div>
                  <label className="text-xs text-slate-300 inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!form.whatsappOptIn}
                      onChange={(e) => setForm((f) => ({ ...f, whatsappOptIn: e.target.checked }))}
                    />
                    Enviar extrato diário por WhatsApp após cada consumo
                  </label>
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-cyan-100 flex items-center gap-2">
                        <ScanLine className="w-4 h-4" />
                        Cartão RFID (obrigatório)
                      </p>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full border ${
                          rfidStatus.connected
                            ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10'
                            : 'border-rose-400/30 text-rose-200 bg-rose-500/10'
                        }`}
                      >
                        {rfidStatus.connected ? 'Leitor pronto' : 'Leitor offline'}
                      </span>
                    </div>
                    {form.rfidUid ? (
                      <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-emerald-400/30 px-3 py-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                        <span className="font-mono text-sm text-emerald-100 truncate">{form.rfidUid}</span>
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-2">
                        <CreditCard className="w-8 h-8 text-cyan-300 mx-auto opacity-80" />
                        <p className="text-slate-300 text-sm">Aproxime o cartão no leitor ACR122U</p>
                      </div>
                    )}
                    {form.rfidUid && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, rfidUid: '' }));
                          setRfidCaptured(false);
                        }}
                        className="text-xs text-slate-400 hover:text-rose-300 underline"
                      >
                        Trocar cartão (leia outro)
                      </button>
                    )}
                    {!rfidStatus.bridgeOnline && (
                      <p className="text-[11px] text-rose-300">
                        Inicie o bridge: <code className="text-cyan-300">npm run dev:rfid</code>
                      </p>
                    )}
                    {rfidCaptured && form.rfidUid && (
                      <p className="text-[11px] text-emerald-300">Cartão capturado com sucesso.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Saldo inicial (R$)"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.balanceBRL}
                      onChange={(e) => setForm((f) => ({ ...f, balanceBRL: e.target.value }))}
                    />
                    <input
                      required
                      placeholder="Teto limite (R$)"
                      className="rounded-xl bg-black/40 border border-white/10 px-3 py-2"
                      value={form.limitMaxBRL}
                      onChange={(e) => setForm((f) => ({ ...f, limitMaxBRL: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {msg && <p className="text-rose-300 text-sm">{msg}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-600 to-violet-600"
              >
                {modal === 'new' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
