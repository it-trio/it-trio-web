/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly GTAG_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  dataLayer: Record<string, any>[];
  gtag: (...args: any[]) => void;
}
