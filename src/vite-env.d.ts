/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARTO_API_KEY?: string;
  readonly VITE_CANAL_RECALL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
