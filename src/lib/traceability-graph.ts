export const GRAPH_TYPES = ['Requirement', 'TestCase', 'TestPlan', 'TestRun', 'Execution', 'BugFix', 'Module'] as const;
export type GraphEntityType = typeof GRAPH_TYPES[number];
export type GraphSeedType = 'TestCase' | 'Requirement' | 'TestRun' | 'BugFix';
export type GraphFocus = { type: GraphSeedType; id: string };
export interface TraceGraphNode {
  id: string;
  entityId: string;
  type: GraphEntityType;
  label: string;
  title: string;
  status: string;
  moduleId?: string;
  moduleName?: string;
  details?: Record<string, string | number>;
}
export interface TraceGraphEdge { id: string; source: string; target: string; label: string }
export interface TraceGraphData {
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
  rootId: string;
  truncated: boolean;
  limits: { cases: number; links: number; executions: number; bugs: number; nodes: number };
}
export const graphKey = (type: GraphEntityType, id: string) => `${type}:${id}`;
export const GRAPH_NODE_WIDTH = 224;
export const GRAPH_NODE_HEIGHT = 112;

// Fixed relationship tiers, stable ordering, no randomized force layout/reflow loop.
export function layoutTraceGraph(nodes: TraceGraphNode[]) {
  const tiers: GraphEntityType[][] = [['Module', 'Requirement'], ['TestCase'], ['TestPlan', 'TestRun'], ['Execution'], ['BugFix']];
  return tiers.flatMap((types, column) => nodes.filter(n => types.includes(n.type))
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    .map((node, row) => ({ ...node, x: 32 + column * 300, y: 32 + row * 148 })));
}

export function directGraphNeighbors(id: string, edges: TraceGraphEdge[]) {
  const ids = new Set([id]);
  for (const edge of edges) {
    if (edge.source === id) ids.add(edge.target);
    if (edge.target === id) ids.add(edge.source);
  }
  return ids;
}

// Explicit overview may be small; initial/reset framing prioritizes readable labels.
export function graphViewport(nodes: ReturnType<typeof layoutTraceGraph>, size: { width: number; height: number }, focusId: string, overview = false) {
  if (!nodes.length) return { x: 24, y: 24, zoom: 1 };
  const width = Math.max(...nodes.map(n => n.x)) + GRAPH_NODE_WIDTH + 32;
  const height = Math.max(...nodes.map(n => n.y)) + GRAPH_NODE_HEIGHT + 32;
  const fitZoom = Math.max(0.04, Math.min(1, (size.width - 32) / width, (size.height - 32) / height));
  const zoom = overview ? fitZoom : Math.max(0.85, fitZoom);
  if (overview || fitZoom >= 0.85) return { x: (size.width - width * zoom) / 2, y: (size.height - height * zoom) / 2, zoom };
  const focus = nodes.find(n => n.id === focusId) || nodes[0];
  return { x: size.width / 2 - (focus.x + GRAPH_NODE_WIDTH / 2) * zoom, y: Math.min(160, size.height * 0.35) - (focus.y + GRAPH_NODE_HEIGHT / 2) * zoom, zoom };
}

export function isTraceGraphData(value: unknown): value is TraceGraphData {
  if (!value || typeof value !== 'object') return false;
  const data = value as TraceGraphData;
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > 120 || data.edges.length > 500 || typeof data.rootId !== 'string' || typeof data.truncated !== 'boolean') return false;
  if (!data.nodes.every(n => n && GRAPH_TYPES.includes(n.type) && ['id', 'entityId', 'label', 'title', 'status'].every(key => typeof n[key as keyof TraceGraphNode] === 'string') && (!n.details || (typeof n.details === 'object' && !Array.isArray(n.details) && Object.values(n.details).every(v => typeof v === 'string' || typeof v === 'number'))))) return false;
  const ids = new Set(data.nodes.map(n => n.id));
  return ids.size === data.nodes.length && ids.has(data.rootId) && data.edges.every(e => e && typeof e.id === 'string' && typeof e.label === 'string' && ids.has(e.source) && ids.has(e.target));
}
