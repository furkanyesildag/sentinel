/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOROBAN_RPC_URL: string;
  readonly VITE_HORIZON_URL: string;
  readonly VITE_NETWORK_PASSPHRASE: string;
  readonly VITE_BLEND_POOL_ID: string;
  readonly VITE_BLEND_BACKSTOP_ID: string;
  readonly VITE_EXPLORER_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
