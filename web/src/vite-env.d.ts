/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_AGENT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
