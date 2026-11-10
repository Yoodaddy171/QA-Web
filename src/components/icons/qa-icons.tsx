import React from 'react';

/**
 * Traceva Design System - Purpose-Built QA Icons
 * Anti-AI-Slop Iconography conforming to Antislop Rule R-04.
 *
 * Characteristics:
 * - Geometric 24x24 optical grid with 1.75px crisp stroke weight.
 * - Subtle 12-16% duotone fill on primary anchor geometry for visual hierarchy and physical craft.
 * - 100% domain-specific: Test scenarios, defect target, telemetry scopes, iteration loops, and directed graphs.
 * - Strictly NO generic AI slop: No Sparkles, Magic Wands, Rainbow Diamonds, or Cartoon Robots.
 */

export interface QAIconProps extends React.ComponentPropsWithoutRef<'svg'> {
  className?: string;
  size?: number | string;
}

/** Dashboard: Telemetry & QA status radar scope */
export const DashboardIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function DashboardIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" fillOpacity="0.14" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="2" fill="currentColor" fillOpacity="0.14" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <circle cx="7" cy="7" r="1" fill="currentColor" />
        <path d="M17 15.5l1.5-1.5" />
      </svg>
    );
  }
);

/** Test Cases: Structured test scenario matrix with verified assertion notch */
export const TestCasesIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function TestCasesIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="currentColor" fillOpacity="0.12" />
        <path d="M7.5 8h9" />
        <path d="M7.5 12h5.5" />
        <path d="M7.5 16h3.5" />
        <path d="M14.5 14.5l1.5 1.5 3-3" strokeWidth="2" />
      </svg>
    );
  }
);

/** Bugs / Defect: Precision technical defect locator with diagnostic radar pins */
export const DefectIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function DefectIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M12 3c-4.5 0-7 2.5-7 6.5 0 5 3.5 9 7 11.5 3.5-2.5 7-6.5 7-11.5 0-4-2.5-6.5-7-6.5z" fill="currentColor" fillOpacity="0.12" />
        <path d="M12 7.5v6" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
        <path d="M3 9.5h4M17 9.5h4M4 14.5h3M17 14.5h3" />
      </svg>
    );
  }
);

/** Automation Logs: Execution terminal console with active pulse indicator */
export const AutomationIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function AutomationIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity="0.1" />
        <path d="M7 9.5l3.5 2.5L7 14.5" strokeWidth="2" />
        <path d="M12.5 14.5h4.5" strokeWidth="2" />
        <circle cx="18" cy="7.5" r="1" fill="currentColor" />
      </svg>
    );
  }
);

/** Test Cycles: Iterative test sprint cycle track with checkpoint verification */
export const TestCyclesIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function TestCyclesIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M21 12a9 9 0 0 0-15.5-6.36L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 15.5 6.36L21 16" />
        <path d="M21 21v-5h-5" />
        <path d="M9 12l2 2 4-4" strokeWidth="2" />
      </svg>
    );
  }
);

/** Traceability: Lineage graph matrix connecting requirements, test cases, and defects */
export const TraceabilityIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function TraceabilityIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <circle cx="6" cy="6" r="3" fill="currentColor" fillOpacity="0.2" />
        <circle cx="18" cy="8" r="2.5" />
        <circle cx="15" cy="18" r="3" fill="currentColor" fillOpacity="0.2" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M8.5 7.5L15.5 8M8.5 17h4M6 9v6.5M16.5 10.5L15.5 15" />
      </svg>
    );
  }
);

/** QA Reports: Audited release documentation with verifiable compliance seal */
export const ReportsIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function ReportsIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H14l6 6v11.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15z" fill="currentColor" fillOpacity="0.1" />
        <path d="M14 2v6h6" />
        <path d="M8 11.5h5M8 15.5h4" />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" fillOpacity="0.2" />
        <path d="M16 14.5v3M14.5 16h3" />
      </svg>
    );
  }
);

/** Workspace Settings: Precision system configuration gear with central axle */
export const WorkspaceSettingsIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function WorkspaceSettingsIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <circle cx="12" cy="12" r="3.25" fill="currentColor" fillOpacity="0.2" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
);

/**
 * QA Copilot & Engineering Intelligence (Anti-AI-Slop replacement for Sparkles ✨ & Bot 🤖)
 * Strictly adheres to Antislop R-04: Uses a technical command diagnostic lens instead of magic glitter.
 */
export const CopilotIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function CopilotIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="currentColor" fillOpacity="0.12" />
        <path d="M7.5 9.5l3 2.5-3 2.5" strokeWidth="2" />
        <path d="M12.5 14.5h4" strokeWidth="2" />
        <circle cx="16.5" cy="8.5" r="1.25" fill="currentColor" />
      </svg>
    );
  }
);

/** Test Generation Synthesis: Schema blueprint with expansion vector (replaces Sparkles on Add/Generate) */
export const GenerateTestCaseIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function GenerateTestCaseIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <rect x="3" y="3" width="13" height="13" rx="2.5" fill="currentColor" fillOpacity="0.12" />
        <path d="M6.5 7h6M6.5 10.5h4" />
        <path d="M18.5 13.5v7M15 17h7" strokeWidth="2" />
      </svg>
    );
  }
);

/** Test Refinement: Precision calibration sliders (replaces Magic Wand on AI Refine) */
export const RefineIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function RefineIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        <circle cx="8" cy="6.5" r="2" fill="currentColor" fillOpacity="0.25" />
        <circle cx="16" cy="12" r="2" fill="currentColor" fillOpacity="0.25" />
        <circle cx="10" cy="17.5" r="2" fill="currentColor" fillOpacity="0.25" />
      </svg>
    );
  }
);

/** Knowledge Base: Architectural technical specification manual */
export const KnowledgeIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function KnowledgeIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="currentColor" fillOpacity="0.1" />
        <path d="M8 7h8M8 11h5" />
      </svg>
    );
  }
);

/** Team & Workspace Access: Multi-seat engineering permissions */
export const TeamIcon = React.forwardRef<SVGSVGElement, QAIconProps>(
  function TeamIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.15" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
);
