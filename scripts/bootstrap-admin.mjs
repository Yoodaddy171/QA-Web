import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const scrypt = promisify(crypto.scrypt);
const db = new PrismaClient();

async function passwordHash(password) {
  if (password.length < 12) throw new Error('QA_BOOTSTRAP_PASSWORD minimal 12 karakter.');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

try {
  if (await db.user.count()) throw new Error('Bootstrap ditolak: user sudah tersedia. Gunakan workspace member management.');
  const email = String(process.env.QA_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  const name = String(process.env.QA_BOOTSTRAP_NAME || '').trim();
  const password = String(process.env.QA_BOOTSTRAP_PASSWORD || '');
  const workspaceName = String(process.env.QA_BOOTSTRAP_WORKSPACE || 'Local Workspace').trim();
  if (!email.includes('@') || !name) throw new Error('QA_BOOTSTRAP_EMAIL dan QA_BOOTSTRAP_NAME wajib diisi.');
  const hashed = await passwordHash(password);
  const result = await db.$transaction(async tx => {
    const workspace = await tx.workspace.upsert({
      where: { slug: 'local-workspace' },
      update: { name: workspaceName },
      create: { id: 'local-workspace', name: workspaceName, slug: 'local-workspace' },
    });
    const user = await tx.user.create({ data: { email, name, passwordHash: hashed } });
    await tx.workspaceMembership.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' } });
    await tx.project.updateMany({ where: { workspaceId: 'local-workspace' }, data: { workspaceId: workspace.id } });
    return { userId: user.id, email: user.email, workspaceId: workspace.id };
  });
  console.log(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
