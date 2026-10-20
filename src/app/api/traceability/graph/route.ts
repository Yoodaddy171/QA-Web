import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { graphKey, type GraphEntityType, type GraphSeedType, type TraceGraphNode, type TraceGraphEdge } from '@/lib/traceability-graph';

// The existing /api/traceability proxy guard authorizes project membership (VIEWER+).
// Every seed and joined resource is additionally bound to that same project here.
const LIMITS = { cases: 12, links: 24, executions: 24, bugs: 16, nodes: 120 };
const SEEDS: GraphSeedType[] = ['TestCase', 'Requirement', 'TestRun', 'BugFix'];
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const short = (s: string) => s.slice(0, 240);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const projectId = p.get('projectId')?.trim();
  const seedType = (p.get('seedType') || 'TestCase') as GraphSeedType;
  const seedId = p.get('seedId')?.trim();
  const q = p.get('q')?.trim() || '';
  if (!projectId || projectId.length > 128 || !SEEDS.includes(seedType) || (seedId?.length || 0) > 128 || q.length > 120) return reply({ error: 'Project, tipe fokus, atau pencarian graph tidak valid.' }, 400);
  try {
    if (!seedId) {
      const text = { contains: q };
      let options: Array<{ id: string; label: string; status: string }>;
      if (seedType === 'Requirement') {
        const rows = await db.requirement.findMany({ where: { projectId, OR: [{ id: text }, { key: text }, { title: text }] }, select: { id: true, key: true, title: true, status: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 21 });
        options = rows.map(r => ({ id: r.id, label: short(`${r.key} — ${r.title}`), status: r.status }));
      } else if (seedType === 'TestRun') {
        const rows = await db.testRun.findMany({ where: { projectId, OR: [{ id: text }, { name: text }] }, select: { id: true, name: true, status: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 21 });
        options = rows.map(r => ({ id: r.id, label: short(r.name), status: r.status }));
      } else if (seedType === 'BugFix') {
        const rows = await db.bugFix.findMany({ where: { projectId, sourceTestCase: { projectId }, OR: [{ id: text }, { testCaseId: text }, { testAction: text }] }, select: { id: true, testCaseId: true, testAction: true, status: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 21 });
        options = rows.map(r => ({ id: r.id, label: short(`${r.testCaseId} — ${r.testAction}`), status: r.status }));
      } else {
        const rows = await db.testCase.findMany({ where: { projectId, OR: [{ id: text }, { testCaseId: text }, { testAction: text }, { page: text }] }, select: { id: true, testCaseId: true, testAction: true, status: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 21 });
        options = rows.map(r => ({ id: r.id, label: short(`${r.testCaseId} — ${r.testAction}`), status: r.status }));
      }
      return reply({ options: options.slice(0, 20), hasMore: options.length > 20 });
    }

    const nodes = new Map<string, TraceGraphNode>();
    const edges = new Map<string, TraceGraphEdge>();
    let truncated = false;
    function node(type: GraphEntityType, id: string, label: string, title: string, status = '', extra: Partial<TraceGraphNode> = {}) {
      const key = graphKey(type, id);
      if (nodes.size >= LIMITS.nodes && !nodes.has(key)) { truncated = true; return; }
      nodes.set(key, { ...extra, id: key, entityId: id, type, label: short(label), title: short(title), status });
    }
    function edge(source: string, target: string, label: string) {
      if (!nodes.has(source) || !nodes.has(target)) return;
      const id = `${source}>${label}>${target}`;
      edges.set(id, { id, source, target, label });
    }
    function bounded<T>(rows: T[], max: number) { if (rows.length > max) truncated = true; return rows.slice(0, max); }
    let caseIds: string[] = [];
    if (seedType === 'TestCase') {
      const seed = await db.testCase.findFirst({ where: { id: seedId, projectId }, select: { id: true } });
      if (!seed) return reply({ error: 'Fokus graph tidak ditemukan pada project ini.' }, 404);
      caseIds = [seed.id];
    } else if (seedType === 'Requirement') {
      const seed = await db.requirement.findFirst({ where: { id: seedId, projectId }, select: { id: true, key: true, title: true, status: true, _count: { select: { testCases: true, testPlans: true } } } });
      if (!seed) return reply({ error: 'Fokus graph tidak ditemukan pada project ini.' }, 404);
      node('Requirement', seed.id, seed.key, seed.title, seed.status, { details: { 'Linked cases': seed._count.testCases, 'Linked plans': seed._count.testPlans, Coverage: seed._count.testCases && seed._count.testPlans ? 'Covered' : seed._count.testCases || seed._count.testPlans ? 'Partial' : 'Uncovered' } });
      const links = await db.requirementTestCase.findMany({ where: { requirementId: seedId, testCase: { projectId } }, select: { testCaseId: true }, orderBy: { testCaseId: 'asc' }, take: LIMITS.cases + 1 });
      caseIds = bounded(links, LIMITS.cases).map(l => l.testCaseId);
    } else if (seedType === 'TestRun') {
      const seed = await db.testRun.findFirst({ where: { id: seedId, projectId }, select: { id: true, name: true, status: true } });
      if (!seed) return reply({ error: 'Fokus graph tidak ditemukan pada project ini.' }, 404);
      node('TestRun', seed.id, seed.name, 'Test Cycle', seed.status);
      const links = await db.testRunCase.findMany({ where: { testRunId: seedId, testCase: { projectId } }, select: { testCaseId: true }, orderBy: { testCaseId: 'asc' }, take: LIMITS.cases + 1 });
      caseIds = bounded(links, LIMITS.cases).map(l => l.testCaseId);
    } else {
      const seed = await db.bugFix.findFirst({ where: { id: seedId, projectId, sourceTestCase: { projectId } }, select: { id: true, sourceTestCaseId: true, testCaseId: true, testAction: true, status: true } });
      if (!seed) return reply({ error: 'Fokus graph tidak ditemukan pada project ini.' }, 404);
      node('BugFix', seed.id, seed.testCaseId, seed.testAction, seed.status);
      caseIds = [seed.sourceTestCaseId];
    }
    const [cases, rawRequirements, rawMemberships, rawExecutions, rawBugs] = await Promise.all([
      db.testCase.findMany({ where: { projectId, id: { in: caseIds } }, select: { id: true, testCaseId: true, testAction: true, page: true, status: true, moduleId: true, module: { select: { id: true, name: true, projectId: true } } }, orderBy: { id: 'asc' }, take: LIMITS.cases }),
      db.requirementTestCase.findMany({ where: { testCaseId: { in: caseIds }, requirement: { projectId }, testCase: { projectId } }, select: { testCaseId: true, requirement: { select: { id: true, key: true, title: true, status: true, _count: { select: { testCases: true, testPlans: true } } } } }, orderBy: { id: 'asc' }, take: LIMITS.links + 1 }),
      db.testRunCase.findMany({ where: { testCaseId: { in: caseIds }, testRun: { projectId }, testCase: { projectId } }, select: { testCaseId: true, testRun: { select: { id: true, name: true, status: true, testPlanId: true } } }, orderBy: { id: 'asc' }, take: LIMITS.links + 1 }),
      db.testExecution.findMany({ where: { testCaseId: { in: caseIds }, testRun: { projectId }, testCase: { projectId } }, select: { id: true, testRunId: true, testCaseId: true, status: true, tester: true, createdAt: true, bugFixId: true, testRun: { select: { id: true, name: true, status: true, testPlanId: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: LIMITS.executions + 1 }),
      db.bugFix.findMany({ where: { projectId, sourceTestCaseId: { in: caseIds }, sourceTestCase: { projectId } }, select: { id: true, testCaseId: true, sourceTestCaseId: true, sourceExecutionId: true, status: true, testAction: true, moduleId: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: LIMITS.bugs + 1 }),
    ]);
    const requirements = bounded(rawRequirements, LIMITS.links), memberships = bounded(rawMemberships, LIMITS.links), executions = bounded(rawExecutions, LIMITS.executions), bugs = bounded(rawBugs, LIMITS.bugs);
    for (const c of cases) {
      const projectModule = c.module?.projectId === projectId ? c.module : null;
      node('TestCase', c.id, c.testCaseId, c.testAction, c.status, { moduleId: projectModule?.id, moduleName: projectModule?.name, details: { Page: c.page } });
      if (projectModule) { node('Module', projectModule.id, projectModule.name, 'Module'); edge(graphKey('Module', projectModule.id), graphKey('TestCase', c.id), 'Mengelompokkan'); }
    }
    // Preserve verified seed memberships even if sibling relation batches hit their caps.
    for (const id of caseIds) {
      if (seedType === 'Requirement') edge(graphKey('Requirement', seedId), graphKey('TestCase', id), 'Mencakup testcase');
      if (seedType === 'TestRun') edge(graphKey('TestCase', id), graphKey('TestRun', seedId), 'Anggota cycle');
    }
    for (const l of requirements) {
      const r = l.requirement;
      node('Requirement', r.id, r.key, r.title, r.status, { details: { 'Linked cases': r._count.testCases, 'Linked plans': r._count.testPlans, Coverage: r._count.testCases && r._count.testPlans ? 'Covered' : r._count.testCases || r._count.testPlans ? 'Partial' : 'Uncovered' } });
      edge(graphKey('Requirement', r.id), graphKey('TestCase', l.testCaseId), 'Mencakup testcase');
    }
    for (const m of memberships) {
      node('TestRun', m.testRun.id, m.testRun.name, 'Test Cycle', m.testRun.status);
      edge(graphKey('TestCase', m.testCaseId), graphKey('TestRun', m.testRun.id), 'Anggota cycle');
    }
    for (const e of executions) {
      node('TestRun', e.testRun.id, e.testRun.name, 'Test Cycle', e.testRun.status);
      node('Execution', e.id, `Execution ${e.id.slice(-6)}`, 'Historical execution', e.status, { details: { Tester: e.tester || '—', Waktu: e.createdAt.toISOString(), 'Cycle ID': e.testRunId } });
      edge(graphKey('TestRun', e.testRunId), graphKey('Execution', e.id), 'Memuat execution');
      edge(graphKey('TestCase', e.testCaseId), graphKey('Execution', e.id), 'Dieksekusi sebagai');
    }
    for (const b of bugs) {
      node('BugFix', b.id, b.testCaseId, b.testAction, b.status, { moduleId: b.moduleId || undefined });
      edge(graphKey('TestCase', b.sourceTestCaseId), graphKey('BugFix', b.id), 'Sumber bug');
      if (b.sourceExecutionId) edge(graphKey('Execution', b.sourceExecutionId), graphKey('BugFix', b.id), 'Melaporkan bug');
    }
    // A selected bug remains present even when its sibling list has been capped.
    if (seedType === 'BugFix' && caseIds[0]) edge(graphKey('TestCase', caseIds[0]), graphKey('BugFix', seedId), 'Sumber bug');
    for (const e of executions) if (e.bugFixId) edge(graphKey('BugFix', e.bugFixId), graphKey('Execution', e.id), 'Retest execution');
    const requirementIds = [...nodes.values()].filter(n => n.type === 'Requirement').map(n => n.entityId);
    const runIds = [...nodes.values()].filter(n => n.type === 'TestRun').map(n => n.entityId);
    const [rawPlanLinks, runs] = await Promise.all([
      db.testPlanRequirement.findMany({ where: { requirementId: { in: requirementIds }, requirement: { projectId }, testPlan: { projectId } }, select: { requirementId: true, testPlan: { select: { id: true, name: true, status: true } } }, orderBy: { id: 'asc' }, take: LIMITS.links + 1 }),
      db.testRun.findMany({ where: { projectId, id: { in: runIds } }, select: { id: true, testPlan: { select: { id: true, name: true, status: true, projectId: true } } }, take: LIMITS.nodes }),
    ]);
    for (const l of bounded(rawPlanLinks, LIMITS.links)) {
      node('TestPlan', l.testPlan.id, l.testPlan.name, 'Test Plan', l.testPlan.status);
      edge(graphKey('Requirement', l.requirementId), graphKey('TestPlan', l.testPlan.id), 'Relasi requirement-plan');
    }
    for (const r of runs) if (r.testPlan?.projectId === projectId) {
      node('TestPlan', r.testPlan.id, r.testPlan.name, 'Test Plan', r.testPlan.status);
      edge(graphKey('TestPlan', r.testPlan.id), graphKey('TestRun', r.id), 'Plan untuk cycle');
    }
    return reply({ nodes: [...nodes.values()], edges: [...edges.values()], rootId: graphKey(seedType, seedId), truncated, limits: LIMITS });
  } catch (error) {
    console.error('Traceability graph failed', { name: error instanceof Error ? error.name : 'unknown' });
    return reply({ error: 'Gagal memuat graph. Coba muat ulang atau pilih fokus lain.' }, 500);
  }
}
