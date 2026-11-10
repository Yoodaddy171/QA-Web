import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  const SecondaryActionIcon = secondaryAction?.icon;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-border/70 bg-secondary/50 text-muted-foreground shadow-2xs">
          <Icon className="size-6 shrink-0" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {(action || secondaryAction || children) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button
              type="button"
              variant={action.variant || 'default'}
              size="sm"
              onClick={action.onClick}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {ActionIcon && <ActionIcon className="size-3.5" aria-hidden="true" />}
              <span>{action.label}</span>
            </Button>
          )}
          {secondaryAction && (
            <Button
              type="button"
              variant={secondaryAction.variant || 'outline'}
              size="sm"
              onClick={secondaryAction.onClick}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {SecondaryActionIcon && <SecondaryActionIcon className="size-3.5" aria-hidden="true" />}
              <span>{secondaryAction.label}</span>
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
