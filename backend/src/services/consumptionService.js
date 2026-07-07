/**
 * Saldo sempre primeiro; o restante vai para o limite (dívida).
 * Bloqueia se o limite disponível não cobrir o restante.
 */
export function computeConsumption(student, totalCents) {
  const balance = student.balance_cents;
  const max = student.credit_limit_max_cents;
  const used = student.limit_used_cents;
  const availableLimit = max - used;

  const fromBalance = Math.min(balance, totalCents);
  const remainder = totalCents - fromBalance;

  if (remainder > availableLimit) {
    const err = new Error('LIMIT_EXCEEDED');
    err.code = 'LIMIT_EXCEEDED';
    err.details = {
      neededFromLimitCents: remainder,
      availableLimitCents: availableLimit,
      balanceCents: balance,
    };
    throw err;
  }

  const newBalance = balance - fromBalance;
  const newLimitUsed = used + remainder;

  const alerts = [];
  if (remainder > 0 && fromBalance === 0) {
    alerts.push({
      type: 'using_limit',
      message: 'Saldo insuficiente — consumo coberto pelo limite.',
    });
  } else if (remainder > 0) {
    alerts.push({
      type: 'partial_limit',
      message: 'Parte do valor foi debitada do limite (saldo parcial).',
    });
  }

  const newAvail = max - newLimitUsed;
  if (max > 0 && newAvail > 0 && newAvail / max <= 0.2) {
    alerts.push({
      type: 'limit_near',
      message: 'Atenção: limite quase esgotado.',
    });
  }

  if (max > 0 && newLimitUsed >= max) {
    alerts.push({
      type: 'limit_full',
      message: 'Limite de crédito atingido — próximos consumos serão bloqueados até quitar a dívida.',
    });
  }

  return {
    fromBalance,
    fromLimit: remainder,
    newBalance,
    newLimitUsed,
    alerts,
  };
}
