import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

type Session = { id: string; cookie: string };

describe('notifications API', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let alice: Session;
  let bob: Session;
  let camryId: string;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    const a = await api.login('user');
    const b = await api.login('user');
    alice = { id: a.user.id, cookie: a.cookie };
    bob = { id: b.user.id, cookie: b.cookie };
    camryId = (await api.vehicles.create(buildVehicle({ make: 'Toyota', model: 'Camry', quantity: 4 }))).id;
  });

  afterAll(() => pool.end());

  async function notify(recipientId: string, minutesAgo: number, extra: { readAt?: Date; resolved?: boolean } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO notifications (recipient_id, type, vehicle_id, quantity, read_at, resolved_at, created_at)
       VALUES ($1, 'BACK_IN_STOCK', $2, 4, $3, $4, now() - make_interval(mins => $5)) RETURNING id`,
      [recipientId, camryId, extra.readAt ?? null, extra.resolved ? new Date() : null, minutesAgo],
    );
    return rows[0].id as string;
  }

  async function readAtOf(id: string) {
    const { rows } = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [id]);
    return rows[0].read_at as Date | null;
  }

  describe('GET /api/notifications', () => {
    it('lists only the caller’s notifications, newest first, with vehicle details and an unread count', async () => {
      const older = await notify(alice.id, 10);
      const newer = await notify(alice.id, 1);
      await notify(bob.id, 5);

      const res = await api.get('/api/notifications', alice.cookie);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(2);
      expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([newer, older]);
      expect(res.body.data[0]).toEqual({
        id: newer,
        type: 'BACK_IN_STOCK',
        vehicle: { id: camryId, make: 'Toyota', model: 'Camry' },
        quantity: 4,
        readAt: null,
        resolvedAt: null,
        createdAt: expect.any(String),
      });
    });

    it('filters to unread notifications', async () => {
      await notify(alice.id, 3, { readAt: new Date() });
      const unread = await notify(alice.id, 2);

      const res = await api.get('/api/notifications?unread=true', alice.cookie);

      expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([unread]);
      expect(res.body.unreadCount).toBe(1);
    });

    it('limits the page size', async () => {
      for (let i = 0; i < 4; i++) await notify(alice.id, i);

      const res = await api.get('/api/notifications?limit=2', alice.cookie);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.unreadCount).toBe(4);
      expect((await api.get('/api/notifications?limit=500', alice.cookie)).status).toBe(400);
    });

    it('shows when an alert was resolved', async () => {
      await notify(alice.id, 1, { resolved: true });

      const res = await api.get('/api/notifications', alice.cookie);

      expect(res.body.data[0].resolvedAt).toEqual(expect.any(String));
    });

    it('is private and never cached', async () => {
      const res = await api.get('/api/notifications', alice.cookie);

      expect(res.headers['cache-control']).toBe('no-store');
      expect((await api.get('/api/notifications')).status).toBe(401);
    });

    it('delivers notices produced by real stock changes', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ model: 'Corolla', quantity: 0 }));
      const admin = await api.login('admin');
      await api.mutate('post', `/api/vehicles/${soldOut.id}/watch`, alice.cookie);
      await api.mutate('post', `/api/vehicles/${soldOut.id}/restock`, admin.cookie).send({ quantity: 2 });
      await api.mutate('post', `/api/vehicles/${camryId}/purchase`, bob.cookie);

      const forAlice = await api.get('/api/notifications', alice.cookie);
      const forAdmin = await api.get('/api/notifications', admin.cookie);

      expect(forAlice.body.data.map((n: { type: string }) => n.type)).toEqual(['BACK_IN_STOCK']);
      expect(forAdmin.body.data.map((n: { type: string; quantity: number }) => [n.type, n.quantity])).toEqual([
        ['LOW_STOCK', 3],
      ]);
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    it('marks the caller’s notification read', async () => {
      const id = await notify(alice.id, 1);

      const res = await api.mutate('post', `/api/notifications/${id}/read`, alice.cookie);

      expect(res.status).toBe(200);
      expect(res.body.notification).toMatchObject({ id, readAt: expect.any(String) });
      expect((await api.get('/api/notifications', alice.cookie)).body.unreadCount).toBe(0);
    });

    it('keeps the first read time when marked again', async () => {
      const firstRead = new Date('2026-10-01T09:00:00Z');
      const id = await notify(alice.id, 1, { readAt: firstRead });

      const res = await api.mutate('post', `/api/notifications/${id}/read`, alice.cookie);

      expect(res.status).toBe(200);
      expect(await readAtOf(id)).toEqual(firstRead);
    });

    it('returns 404 for someone else’s notification and leaves it unread', async () => {
      const bobs = await notify(bob.id, 1);

      const res = await api.mutate('post', `/api/notifications/${bobs}/read`, alice.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Notification not found' });
      expect(await readAtOf(bobs)).toBeNull();
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      expect(
        (await api.mutate('post', '/api/notifications/00000000-0000-4000-8000-000000000000/read', alice.cookie)).status,
      ).toBe(404);
      expect((await api.mutate('post', '/api/notifications/1/read', alice.cookie)).status).toBe(400);
    });

    it('rejects client-supplied fields', async () => {
      const id = await notify(alice.id, 1);

      const res = await api
        .mutate('post', `/api/notifications/${id}/read`, alice.cookie)
        .send({ readAt: '2020-01-01T00:00:00Z', recipientId: bob.id });

      expect(res.status).toBe(400);
      expect(await readAtOf(id)).toBeNull();
    });

    it('requires a session', async () => {
      const id = await notify(alice.id, 1);

      expect((await api.mutate('post', `/api/notifications/${id}/read`)).status).toBe(401);
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('marks all of the caller’s notifications read and nobody else’s', async () => {
      await notify(alice.id, 2);
      await notify(alice.id, 1);
      await notify(alice.id, 3, { readAt: new Date() });
      const bobs = await notify(bob.id, 1);

      const res = await api.mutate('post', '/api/notifications/read-all', alice.cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updated: 2 });
      expect(await readAtOf(bobs)).toBeNull();
    });

    it('requires a session', async () => {
      expect((await api.mutate('post', '/api/notifications/read-all')).status).toBe(401);
    });
  });

  describe('isWatching on vehicle lists', () => {
    it('reports each user’s own watches in list and search results', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ model: 'Corolla', quantity: 0 }));
      await api.mutate('post', `/api/vehicles/${soldOut.id}/watch`, alice.cookie);

      for (const path of ['/api/vehicles?sort=model', '/api/vehicles/search?make=Toyota&sort=model']) {
        const forAlice = await api.get(path, alice.cookie);
        const forBob = await api.get(path, bob.cookie);
        expect(forAlice.body.data.map((v: { model: string; isWatching: boolean }) => [v.model, v.isWatching])).toEqual([
          ['Camry', false],
          ['Corolla', true],
        ]);
        expect(forBob.body.data.every((v: { isWatching: boolean }) => v.isWatching === false)).toBe(true);
      }
    });
  });
});
