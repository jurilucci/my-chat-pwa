// Tipi per import.meta.env (@ngx-env/builder).
// Aggiungi qui ogni NG_APP_* presente in .env (vedi .env.template).
declare interface Env {
  [key: string]: string;
  NG_APP_GOOGLE_ANALYTICS_MEASUREMENT_ID: string;
  NG_APP_IS_ANALYTICS_ENABLED: string;
  NG_APP_IS_LOGGING_ENABLED: string;
  NG_APP_IS_SERVICE_WORKER_ENABLED: string;
  NG_APP_SUPABASE_PUBLISHABLE_OR_ANON_KEY: string;
  NG_APP_SUPABASE_URL: string;
  NG_APP_VAPID_PUBLIC_KEY: string;
  readonly NODE_ENV: string;
}

declare interface ImportMeta {
  readonly env: Env;
}
