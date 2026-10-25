import type { ISalesRepository } from '../repositories/sales.repository';
import type { PurchasePeriod, PurchaseTotals, PurchaseView } from '../types/purchase';

const DAY_MS = 86_400_000;

export interface PurchaseFeed {
  data: PurchaseView[];
  count: number;
  summary: PurchaseTotals;
  days: PurchasePeriod;
}

/** The admin sales feed: recent purchases in a period, with that period's totals. */
export class PurchaseService {
  constructor(
    private readonly sales: ISalesRepository,
    private readonly clock: () => Date,
  ) {}

  async feed({ days, limit, offset }: { days: PurchasePeriod; limit: number; offset: number }): Promise<PurchaseFeed> {
    const to = this.clock();
    const from = new Date(to.getTime() - days * DAY_MS);
    const [page, summary] = await Promise.all([
      this.sales.recent(from, to, { limit, offset }),
      this.sales.totals(from, to),
    ]);
    return { ...page, summary, days };
  }
}
