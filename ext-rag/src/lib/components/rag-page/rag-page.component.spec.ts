import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { RagPageComponent } from './rag-page.component';

/**
 * RagPageComponent only reads `route.queryParams` in ngOnInit, so it is
 * exercised via direct instantiation with a stub ActivatedRoute. This avoids
 * rendering the child chat/search panels (and their HttpClient dependencies).
 */
describe('RagPageComponent', () => {
  function create(queryParams: Record<string, string>): RagPageComponent {
    const route = { queryParams: of(queryParams) } as unknown as ActivatedRoute;
    const component = new RagPageComponent(route);
    component.ngOnInit();
    return component;
  }

  it('prefills folder scope from query params', () => {
    const c = create({ nodeId: 'n1', name: 'Finance', nodeType: 'folder', path: '/Home/Finance' });
    expect(c.prefilledNodeId).toBe('n1');
    expect(c.prefilledNodeName).toBe('Finance');
    expect(c.prefilledNodeIsFolder).toBeTrue();
    expect(c.prefilledNodePath).toBe('/Home/Finance');
  });

  it('treats a non-folder nodeType as a file and defaults absent params to null', () => {
    const c = create({ nodeId: 'n2', name: 'Doc', nodeType: 'file' });
    expect(c.prefilledNodeIsFolder).toBeFalse();
    expect(c.prefilledNodePath).toBeNull();
  });

  it('leaves scope empty when no query params are present', () => {
    const c = create({});
    expect(c.prefilledNodeId).toBeNull();
    expect(c.prefilledNodeName).toBeNull();
    expect(c.prefilledNodeIsFolder).toBeFalse();
  });
});
