/**
 * NgRx action type constants consumed by the extension descriptor
 * and dispatched through the ADF extension mechanism.
 *
 * The JSON plugin maps UI events (button clicks) to these action types;
 * the effects file reacts to them.
 */
export const RAG_OPEN_CHAT  = 'RAG_OPEN_CHAT';
export const RAG_ASK_ABOUT  = 'RAG_ASK_ABOUT';   // context-menu: ask about selected doc
