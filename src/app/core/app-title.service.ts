import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Обёртка над {@link Title}: клеит общий суффикс к переданному заголовку.
 *
 * <p>Route-level {@code title} устанавливается Angular'ом напрямую, минуя
 * этот сервис, поэтому для маршрутов без своего обработчика вкладка будет
 * без суффикса. Для динамических заголовков (проект, документ) всегда
 * используйте {@link set} этого сервиса — суффикс добавится.</p>
 */
@Injectable({ providedIn: 'root' })
export class AppTitleService {
  private readonly title = inject(Title);
  private readonly suffix = 'Document History';

  /**
   * @param pageTitle заголовок текущей страницы (без суффикса)
   */
  set(pageTitle: string): void {
    const t = pageTitle.trim();
    this.title.setTitle(t ? `${t} · ${this.suffix}` : this.suffix);
  }
}
