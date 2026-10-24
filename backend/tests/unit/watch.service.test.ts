import type { ITransactionRunner, Queryable } from '../../src/db/transaction';
import { InStockError, VehicleNotFoundError, WatchLimitReachedError } from '../../src/errors';
import type { IWatchRepository } from '../../src/repositories/watch.repository';
import { WatchService } from '../../src/services/watch.service';

const TX = { query: vi.fn() } as unknown as Queryable;

const inlineTransactions: ITransactionRunner = { run: (fn) => fn(TX) };

class FakeWatchRepository implements IWatchRepository {
  readonly calls: string[] = [];
  readonly watches = new Set<string>();

  constructor(readonly stock: Map<string, number>) {}

  async lockWatcher(_tx: Queryable, userId: string) {
    this.calls.push(`lock:${userId}`);
  }

  async vehicleStock(_tx: Queryable, vehicleId: string) {
    return this.stock.get(vehicleId) ?? null;
  }

  async isWatching(_tx: Queryable, userId: string, vehicleId: string) {
    return this.watches.has(`${userId}/${vehicleId}`);
  }

  async countFor(_tx: Queryable, userId: string) {
    this.calls.push(`count:${userId}`);
    return [...this.watches].filter((w) => w.startsWith(`${userId}/`)).length;
  }

  async add(_tx: Queryable, userId: string, vehicleId: string) {
    this.watches.add(`${userId}/${vehicleId}`);
  }

  async remove(_tx: Queryable, userId: string, vehicleId: string) {
    this.watches.delete(`${userId}/${vehicleId}`);
  }
}

function setup(maxWatches = 50) {
  const repo = new FakeWatchRepository(
    new Map([
      ['sold-out', 0],
      ['in-stock', 4],
      ...Array.from({ length: 60 }, (_, i) => [`gone-${i}`, 0] as [string, number]),
    ]),
  );
  return { repo, service: new WatchService(inlineTransactions, repo, maxWatches) };
}

describe('WatchService.watch', () => {
  it('watches an out-of-stock vehicle', async () => {
    const { repo, service } = setup();

    await service.watch('priya', 'sold-out');

    expect(repo.watches).toEqual(new Set(['priya/sold-out']));
  });

  it('refuses to watch a vehicle that is in stock', async () => {
    const { repo, service } = setup();

    await expect(service.watch('priya', 'in-stock')).rejects.toBeInstanceOf(InStockError);
    expect(repo.watches.size).toBe(0);
  });

  it('rejects an unknown vehicle', async () => {
    const { service } = setup();

    await expect(service.watch('priya', 'ghost')).rejects.toBeInstanceOf(VehicleNotFoundError);
  });

  it('is idempotent', async () => {
    const { repo, service } = setup();

    await service.watch('priya', 'sold-out');
    await service.watch('priya', 'sold-out');

    expect(repo.watches.size).toBe(1);
  });

  it('caps the number of watches per user', async () => {
    const { repo, service } = setup(3);
    for (const id of ['gone-0', 'gone-1', 'gone-2']) await service.watch('priya', id);

    await expect(service.watch('priya', 'gone-3')).rejects.toBeInstanceOf(WatchLimitReachedError);
    expect(repo.watches.size).toBe(3);
  });

  it('still accepts a repeat watch when the user is at the cap', async () => {
    const { service } = setup(1);
    await service.watch('priya', 'gone-0');

    await expect(service.watch('priya', 'gone-0')).resolves.toBeUndefined();
  });

  it('counts each user separately', async () => {
    const { service } = setup(1);
    await service.watch('priya', 'gone-0');

    await expect(service.watch('dana', 'gone-0')).resolves.toBeUndefined();
  });

  it('locks the watcher before counting', async () => {
    const { repo, service } = setup();

    await service.watch('priya', 'sold-out');

    expect(repo.calls).toEqual(['lock:priya', 'count:priya']);
  });
});

describe('WatchService.unwatch', () => {
  it('removes the watch', async () => {
    const { repo, service } = setup();
    await service.watch('priya', 'sold-out');

    await service.unwatch('priya', 'sold-out');

    expect(repo.watches.size).toBe(0);
  });

  it('succeeds when the user was not watching', async () => {
    const { service } = setup();

    await expect(service.unwatch('priya', 'in-stock')).resolves.toBeUndefined();
  });

  it('rejects an unknown vehicle', async () => {
    const { service } = setup();

    await expect(service.unwatch('priya', 'ghost')).rejects.toBeInstanceOf(VehicleNotFoundError);
  });
});
