import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const memberships = await db.testRunCase.findMany({
    select: {
      id: true,
      executions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true, createdAt: true } },
    },
  });
  const updates = memberships
    .filter(item => item.executions[0])
    .map(item => db.testRunCase.update({
      where: { id: item.id },
      data: { latestStatus: item.executions[0].status, latestExecutionAt: item.executions[0].createdAt },
    }));
  for (let index = 0; index < updates.length; index += 100) await db.$transaction(updates.slice(index, index + 100));
  console.log(JSON.stringify({ memberships: memberships.length, updated: updates.length }));
} finally {
  await db.$disconnect();
}
