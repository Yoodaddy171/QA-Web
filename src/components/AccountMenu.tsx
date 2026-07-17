'use client';

import { useEffect, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Account { name: string; email: string; memberships: Array<{ role: string; workspace: { name: string } }> }

export function AccountMenu() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => { void fetch('/api/auth/status', { cache: 'no-store' }).then(response => response.json()).then(data => setAccount(data.user || null)).catch(() => undefined); }, []);
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login');
  };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-9 rounded-lg" aria-label="Menu akun"><UserRound /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuLabel><span className="block truncate text-sm">{account?.name || 'Account'}</span><span className="block truncate text-[11px] font-normal text-muted-foreground">{account?.email || 'Memuat...'}</span></DropdownMenuLabel><DropdownMenuSeparator />{account?.memberships?.[0] && <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">{account.memberships[0].workspace.name} · {account.memberships[0].role}</DropdownMenuLabel>}<DropdownMenuItem className="text-destructive" onClick={() => void logout()}><LogOut />Keluar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
