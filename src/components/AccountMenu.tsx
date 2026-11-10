'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMagneticHover } from '@/lib/client/gsap-motion';

interface Account {
  name: string;
  email: string;
  memberships: Array<{ role: string; workspace: { name: string } }>;
}

export function AccountMenu({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const { guest } = useWorkspaceAccess();
  const [account, setAccount] = useState<Account | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useMagneticHover(triggerRef, { strength: 0.24 });

  const loadAccount = useCallback(() => {
    void fetch('/api/auth/status', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => setAccount(data.user || null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadAccount();
    const handleProfileUpdate = () => loadAccount();
    window.addEventListener('qa-desk:profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('qa-desk:profile-updated', handleProfileUpdate);
  }, [loadAccount]);

  const openProfile = () => {
    if (onOpenProfile) {
      onOpenProfile();
    } else {
      window.dispatchEvent(new CustomEvent('qa-desk:set-tab', { detail: 'profile' }));
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="outline" size="icon" className="size-9 rounded-lg" aria-label="Menu akun">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold">{account?.name || 'Account'}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">
            {guest ? 'Akses tamu sementara' : account?.email || 'Memuat...'}
          </span>
        </DropdownMenuLabel>
        {account?.memberships?.[0] && (
          <DropdownMenuLabel className="pt-0 text-[10px] font-normal text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3 text-primary" />
            <span>
              {account.memberships[0].workspace.name} · {guest ? 'Guest' : account.memberships[0].role}
            </span>
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openProfile} className="cursor-pointer">
          <UserRound className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => void logout()}>
          <LogOut className="size-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
