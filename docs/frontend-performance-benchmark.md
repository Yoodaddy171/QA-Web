# Production performance verification

The benchmark must target a standalone production server, not `next dev`.
The scripts reject non-loopback/non-31xx benchmark URLs. Never use a user's
database, account, environment file, recording, or existing port 3000 process.

## Reproduce

1. Create two separate worktrees from the verified starting SHA and install with
   `npm ci` in each. Apply the optimized frontend diff only in the second.
2. Enable identical instrumentation in both builds: `QA_PERF_PROFILING=1` and
   `NEXT_PUBLIC_QA_PERF_PROFILING=1`. The config and Providers profiler must be
   identical on both sides. Normal builds leave these flags unset.
3. Run `scripts/seed-performance-fixture.mjs` with `QA_BENCH_ROOT` pointing at a
   worktree. It creates only `os.tmpdir()/qadesk-performance-fixture.db`, not a
   user database. Dataset: 150 cases, 120 bugs, 100 automation runs, 60 executions.
4. Generate the synthetic video in the OS Temp folder:
   `ffmpeg -y -f lavfi -i testsrc2=size=640x360:rate=30 -t 10 -c:v libx264 -pix_fmt yuv420p -movflags +faststart <Temp>/qadesk-performance-video.mp4`.
5. Run lint, typecheck, unit tests, then `npm run build`. Start
   `node .next/standalone/server.js` with `DATABASE_URL` set to the absolute Temp
   fixture URL, `HOSTNAME=127.0.0.1`, `PORT=3100`, `APP_URL` and
   `QA_ALLOWED_ORIGINS=http://127.0.0.1:3100`, and `QA_COOKIE_SECURE=0`.
6. Run `scripts/benchmark-production.mjs` with `QA_BENCH_ROOT`,
   `QA_BENCH_LABEL=before` or `after`, and optional `QA_BENCH_URL`. Stop only the
   server you started before starting the other build on the same port. Do not
   run builds, installs, or competing browser tests during measurements.
7. Run `scripts/verify-production-ui.mjs` against the optimized fixture server.
8. Stop that server. Run `npm run test:e2e:production` in the optimized worktree.
   `QA_E2E_PORT` defaults to 3100; the suite always owns its server and uses only
   the dedicated `prisma/db/e2e.db`. `QA_E2E_OUTPUT_DIR` can point outside the repo.

## Measurement contract

- Headed Chromium, 1440 × 900, default hardware acceleration, same binary/options.
- One warm-up, ten measured repetitions per scenario by default (Phase 3).
  `QA_BENCH_REPETITIONS` can reduce diagnostic-only runs. Fixed nominal windows:
  1800 ms ordinarily, 3000 ms for scroll/network expansion, 6000 ms for filter/sort,
  4000 ms for playback, 5000 ms for fullscreen DevLog, 8000 ms for eight menus,
  10000 ms for theme. Earlier undersized windows remain diagnostic artifacts,
  not the standardized comparison for those resampled scenarios.
- Each sample records action time, actual measurement duration and window
  overrun. Reject overruns for standardized comparisons instead of hiding them.
- rAF callback interval mean/P95/P99, percentages >16.67 and >17.5 ms, Long Tasks,
  production React commit durations, DOM nodes, heap snapshots, CDP Chrome traces.
- These are **not exact compositor FPS measurements**. Timing quantization can
  make normal 16.7 ms intervals exceed the nominal 16.67 ms threshold. Use P95,
  the practical threshold, long tasks, and traces together.
- Trace duration sums may overlap/nest and span multiple threads. `RunTask`
  totals are not exclusive CPU time. Layout/Paint/FunctionCall counts and
  durations are diagnostic, not a GPU FPS counter.
- Heap snapshots without a forced GC are trends, not proof of a memory leak.
- Local relay requests/WebSocket are synthetic browser fixtures; application
  API, database, session, and page assets are real production paths. Playback
  validation proves synthetic-media decoding/seeking, not live manual capture.

Artifacts go to OS Temp (`qadesk-phase2-<label>` and `qadesk-phase2-ui-<label>`).
Screenshots, traces and reports should not be committed with application code.

## Phase 3 controls

- Baseline is the preserved uncommitted Phase 2 source, not the Git HEAD alone.
- Normal builds leave `QA_PERF_PROFILING` and
  `NEXT_PUBLIC_QA_PERF_PROFILING` unset. Set both to `1` only for a separate
  diagnostic build; do not compare its frame timing with ordinary builds.
- `QA_BENCH_SCENARIOS` accepts comma-separated independent scenario names.
- `QA_BENCH_WINDOWS` accepts a JSON map of scenario names to measurement
  windows (1800–30000 ms). If actions overrun their original window, exclude
  those frame comparisons and repeat both builds with the same larger window.
- CDP tracing is opt-in via `QA_BENCH_TRACE=1`; LayerTree instrumentation is
  separately opt-in via `QA_BENCH_LAYERS=1` and can add measurement overhead.
- `QA_BENCH_DIAGNOSTIC` supports `no-color`, `no-sticky`, `light-paint`,
  `light-cells`, `20`, `50`, `isolated-table`, `empty`, `inspector`, and
  `system-closed`. DOM reduction, response interception and hiding the shell
  are diagnostics, not application changes or proof of stopped background work.
- Each run checks the served build manifest against the local build ID and
  records a SHA-256 hash of the 150-row synthetic fixture. Baseline/candidate
  fixture hashes must match before status-editing measurements mutate data.
- Search feedback records event-to-next-rAF, not standardized INP. Sample P95
  distributions and action median/P95 accompany aggregate frame statistics.
- `QA_BENCH_FUNCTIONAL=1` verifies synthetic network keyboard expansion,
  headers/payload, wheel scrolling, recording play/seek, and fullscreen exit.
- Keep raw results local. The original Phase 3 request prohibited Git writes;
  on 13 October the user explicitly authorized a commit/push after the final
  running benchmark. No PR or merge is requested.
