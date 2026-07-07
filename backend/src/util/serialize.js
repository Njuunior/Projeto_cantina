export function serializeStudent(row) {
  if (!row) return null;
  const max = row.credit_limit_max_cents;
  const used = row.limit_used_cents;
  const avail = max - used;
  const ratio = max > 0 ? avail / max : 1;
  return {
    id: row.id,
    name: row.name,
    className: row.class_name,
    guardianName: row.guardian_name,
    guardianRelationship: row.guardian_relationship,
    guardianDocument: row.guardian_document,
    guardianContact: row.guardian_contact,
    guardianWhatsapp: row.guardian_whatsapp,
    whatsappOptIn: row.whatsapp_opt_in,
    rfidUid: row.rfid_uid,
    photoUrl: row.photo_path ? `/uploads/${row.photo_path}` : null,
    balanceCents: row.balance_cents,
    creditLimitMaxCents: max,
    limitUsedCents: used,
    limitAvailableCents: avail,
    limitNearExhausted: max > 0 && ratio <= 0.2 && ratio > 0,
    limitFullyUsed: max > 0 && used >= max,
  };
}

export function serializeProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    active: row.active,
    createdAt: row.created_at,
  };
}
