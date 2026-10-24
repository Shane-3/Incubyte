import type { Queryable } from '../../src/db/transaction';
import { BackInStockHandler } from '../../src/handlers/back-in-stock.handler';
import type { IWatcherNotifier } from '../../src/repositories/notification.repository';
import type { StockChange } from '../../src/types/stock';
import type { Vehicle } from '../../src/types/vehicle';

const TX = { query: vi.fn() } as unknown as Queryable;

class RecordingNotifier implements IWatcherNotifier {
  readonly calls: Array<{ tx: Queryable; vehicleId: string; quantity: number }> = [];

  async notifyWatchers(tx: Queryable, vehicleId: string, quantity: number) {
    this.calls.push({ tx, vehicleId, quantity });
    return 2;
  }
}

const vehicle = (quantity: number) => ({ id: 'camry', quantity }) as Vehicle;
const restock: StockChange = { kind: 'restock', quantity: 1 };

async function run(before: number, after: number) {
  const notifier = new RecordingNotifier();
  await new BackInStockHandler(notifier).handle({ change: restock, vehicle: vehicle(after), before, after }, TX);
  return notifier.calls;
}

describe('BackInStockHandler', () => {
  it('notifies watchers when stock goes from zero to available, on the same transaction', async () => {
    expect(await run(0, 4)).toEqual([{ tx: TX, vehicleId: 'camry', quantity: 4 }]);
  });

  it('does nothing when stock was already available', async () => {
    expect(await run(2, 5)).toEqual([]);
  });

  it('does nothing when stock runs out or stays out', async () => {
    expect(await run(1, 0)).toEqual([]);
    expect(await run(0, 0)).toEqual([]);
  });
});
