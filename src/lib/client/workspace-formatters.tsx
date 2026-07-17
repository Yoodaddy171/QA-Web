import { AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

export type StatusBadgeVariant =
  | 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress'
  | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';

export function getStatusColor(status: string) {
  switch (status) {
    case TESTCASE_STATUS.DONE:
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
    case TESTCASE_STATUS.NOT_DONE:
      return 'bg-slate-50 text-slate-600 border border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
    case TESTCASE_STATUS.IN_PROGRESS:
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20';
    case TESTCASE_STATUS.BLOCKED:
      return 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
    case TESTCASE_STATUS.FAILED:
      return 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
    case TESTCASE_STATUS.READY_TO_RETEST:
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200/60 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20';
    case BUGFIX_STATUS.VERIFIED_FIXED:
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
    case TESTCASE_STATUS.TBA:
      return 'bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
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
    case 'Critical': return 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20';
    case 'High': return 'bg-orange-50 text-orange-700 border border-orange-200/60 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20';
    case 'Medium': return 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20';
    case 'Low': return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20';
    default: return 'bg-slate-50 text-slate-700 border border-slate-200/60 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/20';
  }
}

export function getTestTypeColor(type: string) {
  return type === 'Positive'
    ? 'bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20'
    : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
}
