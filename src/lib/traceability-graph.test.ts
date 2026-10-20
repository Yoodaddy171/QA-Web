import { describe, expect, it } from 'vitest';
import { directGraphNeighbors, graphViewport, isTraceGraphData, graphKey, layoutTraceGraph, GRAPH_NODE_HEIGHT, type TraceGraphNode } from './traceability-graph';

const make = (type: TraceGraphNode['type'], id: string): TraceGraphNode => ({ id: graphKey(type, id), entityId: id, type, label: id, title: id, status: '' });

describe('traceability graph', () => {
  it('GRAPH-002: initial framing remains readable on narrow screens; overview is explicit', () => {
    const nodes = layoutTraceGraph([make('Requirement', 'r'), make('TestCase', 'c'), make('BugFix', 'b')]);
    const size = { width: 300, height: 480 };
    expect(graphViewport(nodes, size, 'TestCase:c').zoom).toBeGreaterThanOrEqual(0.85);
    expect(graphViewport(nodes, size, 'TestCase:c', true).zoom).toBeLessThan(0.5);
    const focus = nodes.find(n => n.id === 'TestCase:c')!;
    const view = graphViewport(nodes, size, focus.id);
    expect(view.x + (focus.x + 112) * view.zoom).toBeCloseTo(size.width / 2);
  });
  it('rejects malformed metadata, missing roots and dangling relationship endpoints', () => {
    const base = { nodes: [make('TestCase', 'c')], edges: [], rootId: 'TestCase:c', truncated: false };
    expect(isTraceGraphData(base)).toBe(true);
    expect(isTraceGraphData({ ...base, rootId: 'missing' })).toBe(false);
    expect(isTraceGraphData({ ...base, nodes: [{ ...base.nodes[0], details: { Bad: { nested: true } } }] })).toBe(false);
    expect(isTraceGraphData({ ...base, edges: [{ id: 'bad', source: base.rootId, target: 'missing', label: 'bad' }] })).toBe(false);
  });
  it('namespaces UUIDs by entity type without changing internal identity', () => {
    expect(graphKey('TestCase', 'same')).not.toBe(graphKey('Requirement', 'same'));
    expect(layoutTraceGraph([make('TestCase', 'same')])[0].entityId).toBe('same');
  });
  it('lays out deterministic relationship tiers without overlapping nodes', () => {
    const nodes = [make('BugFix', 'b'), make('TestCase', 'z'), make('Requirement', 'r'), make('TestCase', 'a'), make('Execution', 'e')];
    const result = layoutTraceGraph(nodes);
    expect(result).toEqual(layoutTraceGraph([...nodes].reverse()));
    const cases = result.filter(n => n.type === 'TestCase');
    expect(cases[1].y - cases[0].y).toBeGreaterThan(GRAPH_NODE_HEIGHT);
    expect(result.find(n => n.type === 'Requirement')!.x).toBeLessThan(cases[0].x);
    expect(result.find(n => n.type === 'Execution')!.x).toBeGreaterThan(cases[0].x);
    expect(nodes.map(n => n.entityId)).toEqual(['b', 'z', 'r', 'a', 'e']);
  });
  it('highlights only immediate incoming/outgoing neighbors, not inferred chains', () => {
    const edges = [{ id: '1', source: 'req', target: 'case', label: 'covers' }, { id: '2', source: 'case', target: 'run', label: 'member' }, { id: '3', source: 'run', target: 'execution', label: 'contains' }];
    expect([...directGraphNeighbors('case', edges)].sort()).toEqual(['case', 'req', 'run']);
    expect([...directGraphNeighbors('isolated', edges)]).toEqual(['isolated']);
  });
});
