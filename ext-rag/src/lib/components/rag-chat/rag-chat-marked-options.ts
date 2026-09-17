import { MarkedOptions, MarkedRenderer } from 'ngx-markdown';
import { Tokens } from 'marked/lib/marked';

/**
 * How a generated answer's markdown is rendered.
 *
 * A link in an answer points somewhere outside the current view, so it opens in a new tab with
 * `rel="noopener noreferrer"` rather than replacing the application. This matches what ACA's own AI
 * results view does, so the two behave the same way inside the same shell.
 */
const renderer = new MarkedRenderer();

renderer.link = ({ href, title, text }: Tokens.Link): string =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;

export const ragChatMarkedOptions: MarkedOptions = {
  renderer
};
