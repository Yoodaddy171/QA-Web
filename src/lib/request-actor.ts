import { headers } from 'next/headers';

export interface RequestActor {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  role: string;
}

export async function getRequestActor(): Promise<RequestActor | null> {
  try {
    const values = await headers();
    const userId = values.get('x-qa-user-id') || '';
    if (!userId) return null;
    return {
      userId,
      email: values.get('x-qa-user-email') || '',
      name: decodeURIComponent(values.get('x-qa-user-name') || '') || values.get('x-qa-user-email') || userId,
      workspaceId: values.get('x-qa-workspace-id') || '',
      role: values.get('x-qa-role') || 'VIEWER',
    };
  } catch {
    return null;
  }
}
