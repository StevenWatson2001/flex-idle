// Lets plain Node run the app's TypeScript from a script: Node 24 strips
// the types itself, and this hook resolves what the bundler normally does,
// "@/..." paths and imports written without ".ts". Import it first.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = new URL("../", import.meta.url);
const SUFFIXES = [".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), root).href : specifier;
    const isPath = /^(\.{1,2}\/|file:)/.test(target);
    if (isPath && !/\.(m?[jt]sx?|json)$/.test(target)) {
      const base = new URL(target, context.parentURL).href;
      const found = SUFFIXES.map((suffix) => new URL(base + suffix)).find((url) => existsSync(url));
      if (found) return nextResolve(found.href, context);
    }
    return nextResolve(target, context);
  },
  // The app's TypeScript is all ES modules; saying so saves Node guessing.
  load(url, context, nextLoad) {
    if (url.startsWith(root.href) && !url.includes("/node_modules/") && /\.tsx?$/.test(url)) {
      return nextLoad(url, { ...context, format: "module-typescript" });
    }
    return nextLoad(url, context);
  },
});
