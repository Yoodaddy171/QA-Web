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
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['exceljs'],
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
