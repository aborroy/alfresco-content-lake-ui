import { RagChatSessionService } from './rag-chat-session.service';
import { ChatMessage } from '../models/rag.models';

describe('RagChatSessionService', () => {
  let service: RagChatSessionService;

  const userTurn = (content: string): ChatMessage => ({
    id: `u-${content}`, role: 'user', content, timestamp: new Date()
  });

  beforeEach(() => {
    sessionStorage.clear();
    service = new RagChatSessionService();
  });

  afterEach(() => sessionStorage.clear());

  it('creates a session and starts with no messages', () => {
    const id = service.createSession();
    expect(id).toBeTruthy();
    expect(service.getMessages(id)).toEqual([]);
    expect(service.getActiveSessionId()).toBe(id);
  });

  it('saves messages and derives title + count', () => {
    const id = service.createSession();
    service.saveMessages(id, [userTurn('How do I configure LDAP?')]);

    const summaries = service.listSessions();
    expect(summaries.length).toBe(1);
    expect(summaries[0].title).toBe('How do I configure LDAP?');
    expect(summaries[0].messageCount).toBe(1);
  });

  it('persists across instances via sessionStorage', () => {
    const id = service.createSession();
    service.saveMessages(id, [userTurn('Remembered?')]);

    const reloaded = new RagChatSessionService();
    expect(reloaded.getMessages(id).length).toBe(1);
  });

  describe('renameSession', () => {
    it('migrates a record in place without creating an orphan', () => {
      const uiId = service.createSession();
      service.saveMessages(uiId, [userTurn('Hi')]);

      service.renameSession(uiId, 'backend-1');

      const summaries = service.listSessions();
      expect(summaries.length).toBe(1);
      expect(summaries[0].sessionId).toBe('backend-1');
      expect(service.getActiveSessionId()).toBe('backend-1');
      expect(service.getMessages('backend-1').length).toBe(1);
    });

    it('drops the old orphan when the target id already exists', () => {
      const uiId = service.createSession();
      service.saveMessages(uiId, [userTurn('orphan')]);
      const backendId = service.createSession();
      service.saveMessages(backendId, [userTurn('keep')]);

      service.renameSession(uiId, backendId);

      const ids = service.listSessions().map((s) => s.sessionId);
      expect(ids).not.toContain(uiId);
      expect(ids).toContain(backendId);
    });

    it('is a no-op when ids match', () => {
      const id = service.createSession();
      service.saveMessages(id, [userTurn('x')]);
      service.renameSession(id, id);
      expect(service.listSessions().length).toBe(1);
    });
  });

  it('deletes a session and re-points the active id', () => {
    const first = service.createSession();
    service.saveMessages(first, [userTurn('first')]);
    const second = service.createSession();
    service.saveMessages(second, [userTurn('second')]);

    service.deleteSession(second);

    const ids = service.listSessions().map((s) => s.sessionId);
    expect(ids).not.toContain(second);
    expect(ids).toContain(first);
  });
});
