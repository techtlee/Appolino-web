/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" shows the changelog (src/flags.ts). */
  readonly VITE_FLAG_CHANGELOG?: string;
  /** "1" offers Czech and the language menu (src/flags.ts). */
  readonly VITE_FLAG_CZECH?: string;
  /** "1" shows "How you work in appolino" at the foot of Solutions (src/flags.ts). */
  readonly VITE_FLAG_ROAD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
