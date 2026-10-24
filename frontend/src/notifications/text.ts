import type { AppNotification } from '../api/types';

/** No free text is stored server-side; the wording is built here and rendered as text (security.md 8.4). */
export function noticeText(n: AppNotification): string {
  const name = `${n.vehicle.make} ${n.vehicle.model}`;
  switch (n.type) {
    case 'LOW_STOCK':
      return `${name}: ${n.quantity} left`;
    case 'OUT_OF_STOCK':
      return `${name} is out of stock`;
    case 'BACK_IN_STOCK':
      return `${name} is back in stock`;
  }
}
