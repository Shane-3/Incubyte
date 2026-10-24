import type { Queryable } from '../../src/db/transaction';
import { LowStockAlertHandler } from '../../src/handlers/low-stock-alert.handler';
import type { IAlertWriter } from '../../src/repositories/notification.repository';
import type { StockChange } from '../../src/types/stock';
import type { AdminAlert, AdminAlertType } from '../../src/types/notification';
import type { Vehicle } from '../../src/types/vehicle';

const TX = { query: vi.fn() } as unknown as Queryable;

class RecordingAlertWriter implements IAlertWriter {
  readonly notified: AdminAlert[] = [];
  readonly resolved: AdminAlertType[][] = [];
  readonly txSeen = new Set<Queryable>();

  async notifyAdmins(tx: Queryable, alert: AdminAlert) {
    this.txSeen.add(tx);
    this.notified.push(alert);
  }

  async resolveAlerts(tx: Queryable, _vehicleId: string, types: AdminAlertType[]) {
    this.txSeen.add(tx);
    this.resolved.push([...types].sort());
  }
}

const purchase: StockChange = { kind: 'purchase', quantity: 1, userId: 'priya' };
const restock: StockChange = { kind: 'restock', quantity: 1 };

function vehicle(quantity: number): Vehicle {
  return {
    id: 'camry',
    make: 'Toyota',
    model: 'Camry',
    category: 'Sedan',
    price: 27999,
    quantity,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function run(
  before: number,
  after: number,
  change: StockChange = after < before ? purchase : restock,
  threshold = 3,
) {
  const writer = new RecordingAlertWriter();
  await new LowStockAlertHandler(writer, threshold).handle({ change, vehicle: vehicle(after), before, after }, TX);
  return writer;
}

describe('LowStockAlertHandler (threshold 3)', () => {
  it('raises LOW_STOCK when a purchase crosses into the low band', async () => {
    const writer = await run(5, 3);

    expect(writer.notified).toEqual([{ type: 'LOW_STOCK', vehicleId: 'camry', quantity: 3 }]);
    expect(writer.resolved).toEqual([['OUT_OF_STOCK']]);
  });

  it('keeps raising LOW_STOCK while stock falls inside the band (the store de-duplicates)', async () => {
    const writer = await run(3, 2);

    expect(writer.notified).toEqual([{ type: 'LOW_STOCK', vehicleId: 'camry', quantity: 2 }]);
  });

  it('raises OUT_OF_STOCK at zero and resolves the low-stock alert it supersedes', async () => {
    const writer = await run(1, 0);

    expect(writer.notified).toEqual([{ type: 'OUT_OF_STOCK', vehicleId: 'camry', quantity: 0 }]);
    expect(writer.resolved).toEqual([['LOW_STOCK']]);
  });

  it('only resolves OUT_OF_STOCK when a restock lands inside the low band', async () => {
    const writer = await run(0, 2);

    expect(writer.notified).toEqual([]);
    expect(writer.resolved).toEqual([['OUT_OF_STOCK']]);
  });

  it('resolves every alert when a restock lifts stock above the threshold', async () => {
    const writer = await run(2, 10);

    expect(writer.notified).toEqual([]);
    expect(writer.resolved).toEqual([['LOW_STOCK', 'OUT_OF_STOCK']]);
  });

  it('does nothing for changes that stay above the threshold', async () => {
    const down = await run(10, 8);
    const up = await run(8, 12);

    expect([...down.notified, ...up.notified]).toEqual([]);
    expect([...down.resolved, ...up.resolved]).toEqual([]);
  });

  it('honours a configured threshold', async () => {
    const writer = await run(6, 5, purchase, 5);

    expect(writer.notified).toEqual([{ type: 'LOW_STOCK', vehicleId: 'camry', quantity: 5 }]);
  });

  it('writes on the stock-change transaction', async () => {
    const writer = await run(5, 3);

    expect(writer.txSeen).toEqual(new Set([TX]));
  });
});
