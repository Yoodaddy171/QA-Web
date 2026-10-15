import type { NextConfig } from "next";

const devWatchIgnored = [
  '**/mini-services/logs/**',
  '**/mini-services/logs/**/*.jsonl',
  '**/mini-services/recordings/**',
  '**/mini-services/recordings/**/*',
  '**/prisma/db/**',
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Opt-in profiling build; disabled for normal production deployments.
  reactProductionProfiling: process.env.QA_PERF_PROFILING === '1',
  serverExternalPackages: ['exceljs', '@ffmpeg-installer/ffmpeg'],
  outputFileTracingIncludes: {
    '/api/readiness': [
      './node_modules/@ffmpeg-installer/ffmpeg/**/*',
      `./node_modules/@ffmpeg-installer/${process.platform}-${process.arch}/**/*`,
    ],
  },
  // @ts-ignore
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
          ...devWatchIgnored,
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
