import { AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

export type StatusBadgeVariant =
  | 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress'
  | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';

export function getStatusColor(status: string) {
  switch (status) {
    case TESTCASE_STATUS.DONE:
      return 'qa-status qa-status-passed';
    case TESTCASE_STATUS.NOT_DONE:
      return 'qa-status qa-status-not-run';
    case TESTCASE_STATUS.IN_PROGRESS:
      return 'qa-status qa-status-in-progress';
    case TESTCASE_STATUS.BLOCKED:
      return 'qa-status qa-status-blocked';
    case TESTCASE_STATUS.FAILED:
      return 'qa-status qa-status-failed';
    case TESTCASE_STATUS.READY_TO_RETEST:
      return 'qa-status qa-status-retest';
    case BUGFIX_STATUS.VERIFIED_FIXED:
      return 'qa-status qa-bug-fixed';
    case TESTCASE_STATUS.TBA:
      return 'border border-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-300';
    default:
      return 'qa-status qa-status-not-run';
  }
}

export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case TESTCASE_STATUS.DONE: return 'success';
    case TESTCASE_STATUS.NOT_DONE: return 'notdone';
    case TESTCASE_STATUS.IN_PROGRESS: return 'inprogress';
    case TESTCASE_STATUS.BLOCKED: return 'blocked';
    case TESTCASE_STATUS.FAILED: return 'failed';
    case TESTCASE_STATUS.READY_TO_RETEST: return 'readyretest';
    case BUGFIX_STATUS.VERIFIED_FIXED: return 'verifiedfixed';
    case TESTCASE_STATUS.TBA: return 'tba';
    default: return 'outline';
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case TESTCASE_STATUS.DONE: return <CheckCircle2 className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.NOT_DONE: return <XCircle className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.IN_PROGRESS: return <Clock className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.BLOCKED: return <AlertTriangle className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.FAILED: return <XCircle className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.READY_TO_RETEST: return <RefreshCw className="h-3.5 w-3.5" />;
    case BUGFIX_STATUS.VERIFIED_FIXED: return <CheckCircle2 className="h-3.5 w-3.5" />;
    case TESTCASE_STATUS.TBA: return <HelpCircle className="h-3.5 w-3.5" />;
    default: return <XCircle className="h-3.5 w-3.5" />;
  }
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'Critical': return 'bg-red-500/10 text-red-700 border border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 font-semibold';
    case 'High': return 'bg-amber-500/10 text-amber-800 border border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    case 'Medium': return 'bg-secondary/80 text-foreground border border-border';
    case 'Low': return 'bg-secondary/45 text-muted-foreground border border-border/80';
    default: return 'bg-secondary/45 text-muted-foreground border border-border/80';
  }
}

export function getTestTypeColor(type: string) {
  return type === 'Positive'
    ? 'bg-secondary/75 text-foreground border border-border'
    : 'bg-secondary/45 text-muted-foreground border border-border/90';
}
