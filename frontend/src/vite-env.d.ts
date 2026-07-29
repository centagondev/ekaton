/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  /** "true" enables the temporary marketing/demo mode. */
  readonly VITE_PUBLIC_SPEAKING_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
