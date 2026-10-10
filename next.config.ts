import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Where next-intl finds each request's language and messages. This is
      // all next-intl's plugin would set for us, but the plugin also loads
      // @swc/core, whose native binding fails to load on Steven's machine.
      "next-intl/config": "./i18n/request.ts",
    },
  },
};

export default nextConfig;
