import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData, DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import localeRu from '@angular/common/locales/ru';

import { routes } from './app.routes';
import { accountInterceptor } from './core/account.interceptor';

// Регистрируем русскую локаль. Формат дат будет:
//   28 сент. 2026 г., 16:09
// Если оставить en-US — будет "Sep 28, 2026, 4:09 PM".
registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([accountInterceptor])),

    // Все DatePipe без явной таймзоны показывают московское время.
    {
      provide: DATE_PIPE_DEFAULT_OPTIONS,
      useValue: { timezone: 'Europe/Moscow' },
    },

    // Русская локаль для месяцев/дней недели.
    { provide: LOCALE_ID, useValue: 'ru' },
  ],
};
