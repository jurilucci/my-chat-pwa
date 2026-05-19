import { InjectionToken } from '@angular/core';

export const VAPID_PUBLIC_KEY: InjectionToken<string> = new InjectionToken<string>(
  'VAPID_PUBLIC_KEY',
  { factory: () => import.meta.env.NG_APP_VAPID_PUBLIC_KEY ?? '', providedIn: 'root' },
);
