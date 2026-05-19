/* eslint-disable no-console */

import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeEn from '@angular/common/locales/en';
import localeIt from '@angular/common/locales/it';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '@jet/components/app/app.component';
import { appConfig } from './app/app.config';

registerLocaleData(localeEn);
registerLocaleData(localeIt);
registerLocaleData(localeIt, 'it-IT');
registerLocaleData(localeAr);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
