/// <reference types="vite/client" />

import type { NormalizedCacheObject } from "@apollo/client";

interface ImportMetaEnv {
  /** Public API URL used by the browser (CSR) */
  readonly VITE_API_URL: string;
  /** Optional internal API URL used during SSR (defaults to VITE_API_URL) */
  readonly VITE_SSR_API_URL?: string;
  /**
   * GA4 Measurement ID for the current environment's data stream.
   * Differs per environment (dev/staging stream vs. production stream).
   * When unset, analytics is disabled.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** Whether the public sign-up entry point is visible. */
  readonly VITE_SIGNUP_ENABLED?: string;
  /** Hides email-only recovery UI when OTP delivery uses operator logs. */
  readonly VITE_SIGNUP_OTP_DELIVERY?: "email" | "log";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __APOLLO_STATE__?: NormalizedCacheObject;
    __THEME__?: "light" | "dark"; // SSR-injected theme (always resolved, never "system")
  }
}
