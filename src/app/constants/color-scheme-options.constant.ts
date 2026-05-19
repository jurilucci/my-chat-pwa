import { ColorSchemeOption } from '@jet/interfaces/color-scheme-option.interface';
import { marker } from '@jsverse/transloco-keys-manager/marker';

export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = [
  {
    icon: 'contrast',
    nameKey: marker('constants.automatic'),
    themeColor: '#ffffff',
    value: 'automatic',
  },
  { icon: 'light_mode', nameKey: marker('constants.light'), themeColor: '#f9f9ff', value: 'light' },
  { icon: 'dark_mode', nameKey: marker('constants.dark'), themeColor: '#101319', value: 'dark' },
];
