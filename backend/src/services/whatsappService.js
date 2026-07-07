function sanitizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function brlLine(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function isDebug() {
  const v = process.env.WHATSAPP_DEBUG;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * WhatsApp Cloud API (Meta): o **remetente** é sempre o número vinculado ao
 * `WHATSAPP_PHONE_NUMBER_ID` no painel da Meta — não dá para escolher outro “de” no JSON.
 * Para que as mensagens saiam do (71) 99947-7669, essa linha precisa ser a número WhatsApp
 * Business conectado ao app e o ID correspondente vai em PHONE_NUMBER_ID.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export async function sendPurchaseNotificationWhatsapp({ student, lines, totalCents, summary }) {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';
  const testOverrideTo = process.env.WHATSAPP_TEST_OVERRIDE_TO?.trim();

  if (!token || !phoneNumberId) {
    if (isDebug()) {
      console.warn(
        '[WhatsApp] Envio ignorado: defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no backend/.env'
      );
    }
    return { ok: false, skipped: true, reason: 'missing_credentials' };
  }

  if (!student?.whatsappOptIn) {
    if (isDebug()) {
      console.warn('[WhatsApp] Envio ignorado: aluno sem autorização (whatsappOptIn).', {
        studentId: student?.id,
      });
    }
    return { ok: false, skipped: true, reason: 'opt_out' };
  }

  let to = sanitizePhone(student.guardianWhatsapp || student.guardianContact);
  if (testOverrideTo) {
    to = sanitizePhone(testOverrideTo);
    if (isDebug()) {
      console.log('[WhatsApp] WHATSAPP_TEST_OVERRIDE_TO ativo → destino forçado:', to);
    }
  }

  if (!to) {
    if (isDebug()) {
      console.warn('[WhatsApp] Envio ignorado: cadastre WhatsApp ou contato do responsável no aluno.');
    }
    return { ok: false, skipped: true, reason: 'no_phone' };
  }

  const itemsText = lines
    .map(
      (l) =>
        `• ${l.productName} × ${l.quantity} = R$ ${brlLine(l.lineTotalCents)}`
    )
    .join('\n');

  const text =
    `Cantina — compra confirmada\n` +
    `Aluno: ${student.name} (${student.className || ''})\n\n` +
    `Itens:\n${itemsText}\n\n` +
    `Total da compra: R$ ${brlLine(totalCents)}\n` +
    `Total gasto hoje: R$ ${brlLine(summary.spentTodayCents)}\n` +
    `Saldo atual: R$ ${brlLine(summary.balanceCents)}\n` +
    `Limite usado: R$ ${brlLine(summary.limitUsedCents)}\n` +
    `Horário: ${new Date().toLocaleString('pt-BR')}`;

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
  } catch (e) {
    console.error('[WhatsApp] Falha de rede:', e.message);
    return { ok: false, error: e.message };
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error('[WhatsApp] Erro da API Meta (HTTP', res.status, '):', raw);
    return { ok: false, status: res.status, body: raw };
  }

  if (isDebug()) {
    console.log('[WhatsApp] Mensagem aceita pela API. Destino:', to, 'Resposta:', raw.slice(0, 300));
  }

  return { ok: true, body: raw };
}
