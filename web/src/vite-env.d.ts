/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DYNAMIC_ENVIRONMENT_ID: string;
  readonly VITE_AGENT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
