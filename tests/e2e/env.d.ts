// The little of Node the suite's files use, declared here rather than by installing @types/node:
// the app's own tsconfig takes in every @types package there is, and Node's timers would turn
// the page's `setTimeout` into something that is not a number.
declare const process: { env: Record<string, string | undefined>; platform: string };
declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
