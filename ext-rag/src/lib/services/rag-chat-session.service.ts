import { Injectable } from '@angular/core';

import { ChatMessage } from '../models/rag.models';

interface RagChatSessionRecord {
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

interface StoredRagChatSessionRecord {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

interface RagChatSessionState {
  activeSessionId: string | null;
  sessions: RagChatSessionRecord[];
}

interface StoredRagChatSessionState {
  activeSessionId: string | null;
  sessions: StoredRagChatSessionRecord[];
}

interface StoredChatMessage extends Omit<ChatMessage, 'timestamp'> {
  timestamp: string;
}

export interface RagChatSessionSummary {
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

/**
 * Persists chat sessions for the extension so state survives route changes.
 *
 * State is kept in memory and mirrored to sessionStorage.
 */
@Injectable({ providedIn: 'root' })
export class RagChatSessionService {

  private static readonly STORAGE_KEY = 'ext-rag.chat.sessions.v1';

  private state: RagChatSessionState = this.loadState();

  ensureActiveSession(): string {
    const current = this.state.activeSessionId;
    if (current && this.findSession(current)) {
      return current;
    }

    if (this.state.sessions.length > 0) {
      this.state.activeSessionId = this.state.sessions[0].sessionId;
      this.persist();
      return this.state.activeSessionId;
    }

    return this.createSession();
  }

  createSession(): string {
    const now = new Date();
    const sessionId = this.generateSessionId();
    const session: RagChatSessionRecord = {
      sessionId,
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    this.state.sessions = [session, ...this.state.sessions];
    this.state.activeSessionId = sessionId;
    this.persist();
    return sessionId;
  }

  activateSession(sessionId: string): void {
    if (!this.findSession(sessionId)) {
      return;
    }
    this.state.activeSessionId = sessionId;
    this.persist();
  }

  getActiveSessionId(): string | null {
    return this.state.activeSessionId;
  }

  listSessions(): RagChatSessionSummary[] {
    return this.state.sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      messageCount: session.messages.length
    }));
  }

  getMessages(sessionId: string): ChatMessage[] {
    const session = this.findSession(sessionId);
    if (!session) {
      return [];
    }
    return session.messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp)
    }));
  }

  saveMessages(sessionId: string, messages: ChatMessage[]): void {
    const now = new Date();
    const normalizedMessages = messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp ?? now)
    }));
    const existing = this.findSession(sessionId);

    if (existing) {
      existing.messages = normalizedMessages;
      existing.updatedAt = this.resolveUpdatedAt(normalizedMessages, now);
      existing.title = this.resolveTitle(normalizedMessages);
    } else {
      const createdAt = this.resolveCreatedAt(normalizedMessages, now);
      this.state.sessions.push({
        sessionId,
        title: this.resolveTitle(normalizedMessages),
        createdAt,
        updatedAt: this.resolveUpdatedAt(normalizedMessages, now),
        messages: normalizedMessages
      });
    }

    this.state.sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    this.state.activeSessionId = sessionId;
    this.persist();
  }

  private findSession(sessionId: string): RagChatSessionRecord | undefined {
    return this.state.sessions.find((session) => session.sessionId === sessionId);
  }

  private resolveTitle(messages: ChatMessage[]): string {
    const firstUserTurn = messages.find((message) => message.role === 'user' && message.content?.trim());
    if (!firstUserTurn) {
      return 'New conversation';
    }

    const content = firstUserTurn.content.trim();
    return content.length > 72 ? `${content.slice(0, 69)}...` : content;
  }

  private resolveCreatedAt(messages: ChatMessage[], fallback: Date): Date {
    if (messages.length === 0) {
      return fallback;
    }

    let createdAt = new Date(messages[0].timestamp);
    for (const message of messages) {
      const ts = new Date(message.timestamp);
      if (ts.getTime() < createdAt.getTime()) {
        createdAt = ts;
      }
    }
    return createdAt;
  }

  private resolveUpdatedAt(messages: ChatMessage[], fallback: Date): Date {
    if (messages.length === 0) {
      return fallback;
    }

    let updatedAt = new Date(messages[0].timestamp);
    for (const message of messages) {
      const ts = new Date(message.timestamp);
      if (ts.getTime() > updatedAt.getTime()) {
        updatedAt = ts;
      }
    }
    return updatedAt;
  }

  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `ui-${crypto.randomUUID()}`;
    }
    const suffix = Math.random().toString(36).slice(2, 10);
    return `ui-${Date.now()}-${suffix}`;
  }

  private loadState(): RagChatSessionState {
    const empty: RagChatSessionState = { activeSessionId: null, sessions: [] };
    if (typeof sessionStorage === 'undefined') {
      return empty;
    }

    try {
      const raw = sessionStorage.getItem(RagChatSessionService.STORAGE_KEY);
      if (!raw) {
        return empty;
      }

      const parsed = JSON.parse(raw) as StoredRagChatSessionState;
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.map((session) => ({
          sessionId: session.sessionId,
          title: session.title || 'New conversation',
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: (session.messages ?? []).map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp)
          }))
        }))
        : [];

      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const activeSessionId = parsed.activeSessionId ?? sessions[0]?.sessionId ?? null;

      return { activeSessionId, sessions };
    } catch {
      return empty;
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    const payload: StoredRagChatSessionState = {
      activeSessionId: this.state.activeSessionId,
      sessions: this.state.sessions.map((session) => ({
        sessionId: session.sessionId,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map((message) => ({
          ...message,
          timestamp: message.timestamp.toISOString()
        }))
      }))
    };

    sessionStorage.setItem(RagChatSessionService.STORAGE_KEY, JSON.stringify(payload));
  }
}
