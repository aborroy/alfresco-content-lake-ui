import { findEcmTicket } from './ecm-ticket.util';

describe('findEcmTicket', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads a ticket from a known key in localStorage', () => {
    localStorage.setItem('ticket-ECM', 'TICKET_abc123');
    expect(findEcmTicket()).toBe('TICKET_abc123');
  });

  it('strips surrounding quotes', () => {
    localStorage.setItem('auth_ticket', '"TICKET_quoted"');
    expect(findEcmTicket()).toBe('TICKET_quoted');
  });

  it('falls back to scanning arbitrary keys for a TICKET_ value', () => {
    localStorage.setItem('some-other-key', 'TICKET_scanned');
    expect(findEcmTicket()).toBe('TICKET_scanned');
  });

  it('prefers localStorage over sessionStorage', () => {
    localStorage.setItem('ticket-ECM', 'TICKET_local');
    sessionStorage.setItem('ticket-ECM', 'TICKET_session');
    expect(findEcmTicket()).toBe('TICKET_local');
  });

  it('reads from sessionStorage when localStorage has none', () => {
    sessionStorage.setItem('ticket_ECM', 'TICKET_session');
    expect(findEcmTicket()).toBe('TICKET_session');
  });

  it('returns null when no ticket is present', () => {
    localStorage.setItem('unrelated', 'not-a-ticket');
    expect(findEcmTicket()).toBeNull();
  });
});
