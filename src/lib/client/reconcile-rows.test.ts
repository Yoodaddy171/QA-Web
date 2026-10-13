import { describe, expect, it } from 'vitest';
import { reconcileRows } from './reconcile-rows';
describe('page row reconciliation', () => {
  const a = { id:'a', status:'DONE', module:{ name:'Checkout' }, tags:['smoke'] };
  const b = { id:'b', status:'FAILED', module:null, tags:[] };
  it('preserves identical page and nested row references', () => { const previous=[a,b];expect(reconcileRows(previous,structuredClone(previous))).toBe(previous); });
  it('preserves ordering from the server without remounting unchanged rows', () => {const next=reconcileRows([a,b],structuredClone([b,a]));expect(next).toEqual([b,a]);expect(next[0]).toBe(b);});
  it('does not hide changes to status, nested labels, tags or removed fields', () => {
    for(const next of [{...a,status:'FAILED'},{...a,module:{name:'Orders'}},{...a,tags:['regression']},{id:'a',status:'DONE'}]) expect(reconcileRows([a],[next as typeof a])[0]).toBe(next);
  });
});
