const ECM_TICKET_KEYS = ['ticket-ECM', 'ticket_ECM', 'auth_ticket'];

function normalizeTicket(value: string): string {
  return value.trim().replace(/^"+|"+$/g, '');
}

function readTicketFromStorage(storage: Storage | null | undefined): string | null {
  if (!storage) {
    return null;
  }

  for (const key of ECM_TICKET_KEYS) {
    const value = storage.getItem(key);
    if (!value) {
      continue;
    }

    const normalized = normalizeTicket(value);
    if (normalized.startsWith('TICKET_')) {
      return normalized;
    }
  }

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) {
      continue;
    }

    const value = storage.getItem(key);
    if (!value) {
      continue;
    }

    const normalized = normalizeTicket(value);
    if (normalized.startsWith('TICKET_')) {
      return normalized;
    }
  }

  return null;
}

export function findEcmTicket(): string | null {
  const local = typeof localStorage !== 'undefined' ? localStorage : null;
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  return readTicketFromStorage(local) ?? readTicketFromStorage(session);
}

