'use client';

import React, { useEffect, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Cpu,
  GitBranch,
  Layers,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TestCaseItem {
  id: string;
  name: string;
  endpoint: string;
  latency: string;
  status: 'passed' | 'running';
}

const TEST_CASES: TestCaseItem[] = [
  {
    id: 'IKF-01',
    name: 'Authentication & RBAC Policy',
    endpoint: 'POST /api/auth/login : 200 OK',
    latency: '12ms',
    status: 'passed',
  },
  {
    id: 'IKF-04',
    name: 'Playwright Studio DevLog Stream',
    endpoint: 'Chromium persistent session context',
    latency: '240ms',
    status: 'passed',
  },
  {
    id: 'IKF-08',
    name: 'SQLite Traceability Graph Matrix',
    endpoint: 'Requirements to test cases mapped',
    latency: '38ms',
    status: 'passed',
  },
  {
    id: 'IKF-12',
    name: 'Excel Bulk Normalization Pipeline',
    endpoint: 'Multi-sheet test suite validation',
    latency: '64ms',
    status: 'passed',
  },
];

const LIVE_EVENTS = [
  'PASS : POST /api/auth/status [JWT valid, 8ms]',
  'PASS : SQLite PRAGMA foreign_keys = ON [1ms]',
  'SCAN : Playwright headless worker connected [14ms]',
  'VERIFIED : Traceability graph cycle check [0 cycles]',
  'PASS : Argon2 password verification hash [84ms]',
];

export function QAPipelineHero() {
  const [activeTestIndex, setActiveTestIndex] = useState(0);
  const [eventLogIndex, setEventLogIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Cycle the live scanning test case every 2.8s
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveTestIndex((prev) => (prev + 1) % TEST_CASES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Cycle the console telemetry ticker every 2.2s
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setEventLogIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div className="relative z-10 flex h-full min-h-[640px] w-full flex-col justify-between overflow-hidden">
      {/* Background Animated SVG Circuit & Signal Stream */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full opacity-40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>

          <pattern id="dotGrid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#4f46e5" fillOpacity="0.18" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#dotGrid)" />

        {/* Dynamic Curved Circuit Paths with Traveling Signals */}
        <path
          d="M 50 120 Q 220 180, 340 320 T 560 480"
          fill="none"
          stroke="url(#circuitGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 8"
        />
        <path
          d="M 0 460 C 180 440, 280 580, 480 620"
          fill="none"
          stroke="url(#circuitGrad)"
          strokeWidth="1.2"
        />

        {!isPaused && (
          <>
            <circle r="4" fill="#10b981" filter="drop-shadow(0 0 6px #10b981)">
              <animateMotion
                path="M 50 120 Q 220 180, 340 320 T 560 480"
                dur="7s"
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3.5" fill="#6366f1" filter="drop-shadow(0 0 6px #6366f1)">
              <animateMotion
                path="M 0 460 C 180 440, 280 580, 480 620"
                dur="9s"
                repeatCount="indefinite"
              />
            </circle>
          </>
        )}
      </svg>

      {/* Top Header: BrandMark & Live Engine Telemetry Pill */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <BrandMark />
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1 text-xs font-mono text-zinc-300 shadow-sm backdrop-blur-md">
          <span className="relative flex size-2">
            {!isPaused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>Engine Telemetry Active</span>
        </div>
      </div>

      {/* Center: Live Interactive QA Execution Matrix Card */}
      <div className="relative z-10 my-auto py-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-[500px] overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/85 p-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Ambient Lighting Gradient Accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-56 rounded-full bg-indigo-500/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 size-56 rounded-full bg-emerald-500/10 blur-3xl"
          />

          {/* Test Run Header with Live Pulsing Radar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex size-8 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
                <Layers className="size-4" />
              </div>
              <div>
                <p className="font-mono text-xs font-semibold text-zinc-200">
                  SUITE #104 : AUTOMATED RUN
                </p>
                <p className="text-[11px] text-zinc-400">Playwright &amp; API Integration</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-bold text-emerald-400 shadow-inner">
              <Radio className="size-3 animate-pulse text-emerald-400" />
              LIVE SCANNING
            </span>
          </div>

          {/* Animated Test Cases List */}
          <div className="mt-4 space-y-2.5">
            {TEST_CASES.map((item, index) => {
              const isActive = index === activeTestIndex;
              return (
                <motion.div
                  key={item.id}
                  animate={{
                    scale: isActive ? 1.015 : 1,
                    borderColor: isActive ? 'rgba(99, 102, 241, 0.5)' : 'rgba(39, 39, 42, 0.6)',
                    backgroundColor: isActive
                      ? 'rgba(99, 102, 241, 0.08)'
                      : 'rgba(24, 24, 27, 0.45)',
                  }}
                  transition={{ duration: 0.3 }}
                  className="relative flex items-center justify-between overflow-hidden rounded-xl border px-3.5 py-2.5 transition-colors"
                >
                  {/* Active Scan Laser Shimmer Indicator */}
                  {isActive && !isPaused && (
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: '200%' }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                      className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-400/15 to-transparent"
                    />
                  )}

                  <div className="flex items-center gap-2.5">
                    <CheckCircle2
                      className={`size-4 shrink-0 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-emerald-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-200">
                        <span className="font-mono text-zinc-400 mr-1.5">{item.id}</span>
                        {item.name}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-400 truncate">{item.endpoint}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">
                        RUNNING
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-emerald-400">
                        PASSED
                      </span>
                    )}
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                      {item.latency}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Live Telemetry Log Strip Ticker */}
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-3.5 py-2 text-xs font-mono text-zinc-300">
            <Terminal className="size-3.5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={eventLogIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="truncate text-[11px] text-zinc-300"
                >
                  {LIVE_EVENTS[eventLogIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 animate-ping" />
          </div>

          {/* Aggregate Metrics Footer */}
          <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 text-center">
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Test Cases
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-zinc-100">48 Active</p>
            </div>
            <div className="border-x border-zinc-800/80">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Flaky Rate
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">0.0%</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Coverage
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-indigo-400">96.4%</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Section: Narrative, System Specs & Animation Pause Control */}
      <div className="relative z-10 flex flex-col gap-3 pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-medium tracking-tight text-zinc-100 sm:text-4xl">
              Quality, connected.
            </h2>
            <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-zinc-400">
              Pusat pengelolaan test case, eksekusi otomatis, dan traceability dalam satu workspace kerja.
            </p>
          </div>

          {/* Animation Toggle Control */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused((prev) => !prev)}
            className="h-8 gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-pressed={isPaused}
          >
            {isPaused ? (
              <>
                <Play className="size-3" />
                <span>Putar animasi</span>
              </>
            ) : (
              <>
                <Pause className="size-3" />
                <span>Jeda animasi</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800/80 pt-3 text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Cpu className="size-3 text-zinc-400" /> Traceva Engine v0.2.0
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-zinc-400" /> Argon2 &amp; JWT Security
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-3 text-zinc-400" /> SQLite Local DB
          </span>
        </div>
      </div>
    </div>
  );
}
