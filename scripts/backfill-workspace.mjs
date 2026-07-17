import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const workspace = await db.workspace.upsert({
    where: { slug: 'local-workspace' },
    update: {},
    create: { id: 'local-workspace', name: 'Local Workspace', slug: 'local-workspace' },
  });
  const updated = await db.project.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
  console.log(JSON.stringify({ workspaceId: workspace.id, projectsUpdated: updated.count }));
} finally {
  await db.$disconnect();
}
