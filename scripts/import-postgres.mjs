import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/postgresql-client';

const db = new PrismaClient({ datasourceUrl: process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL });
const inputPath = path.resolve(process.argv[2] || 'data-migration/sqlite-export.json');
const withDates = (rows, fields) => rows.map(row => ({
  ...row,
  ...Object.fromEntries(fields.filter(field => row[field]).map(field => [field, new Date(row[field])])),
}));

try {
  const data = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const projects = withDates(data.projects, ['createdAt', 'updatedAt']);
  const modules = withDates(data.modules, ['createdAt', 'updatedAt']);
  const projectKnowledge = withDates(data.projectKnowledge, ['createdAt', 'updatedAt']);
  const testCases = withDates(data.testCases, ['createdAt', 'updatedAt']);
  const bugFixes = withDates(data.bugFixes, [
    'reportedAt', 'fixingAt', 'readyAt', 'fixedAt', 'createdAt', 'updatedAt',
  ]);
  await db.$transaction(async tx => {
    await tx.project.createMany({ data: projects, skipDuplicates: true });
    await tx.module.createMany({ data: modules, skipDuplicates: true });
    await tx.projectKnowledge.createMany({ data: projectKnowledge, skipDuplicates: true });
    await tx.testCase.createMany({ data: testCases, skipDuplicates: true });
    await tx.bugFix.createMany({ data: bugFixes, skipDuplicates: true });
  });

  const counts = {
    projects: await db.project.count(),
    projectKnowledge: await db.projectKnowledge.count(),
    modules: await db.module.count(),
    testCases: await db.testCase.count(),
    bugFixes: await db.bugFix.count(),
  };
  const mismatches = Object.entries(data.counts)
    .filter(([key, expected]) => counts[key] < expected)
    .map(([key, expected]) => `${key}: expected at least ${expected}, found ${counts[key]}`);
  if (mismatches.length) throw new Error(`Import verification failed: ${mismatches.join('; ')}`);
  console.log(`PostgreSQL import verified from ${inputPath}`);
  console.log(JSON.stringify(counts));
} finally {
  await db.$disconnect();
}
