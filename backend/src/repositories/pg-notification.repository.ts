import type { Pool } from 'pg';
import type { Queryable } from '../db/transaction';
import type { AdminAlert, AdminAlertType } from '../types/notification';
import type { INotificationRepository } from './notification.repository';

export class PgNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async notifyAdmins(_tx: Queryable, _alert: AdminAlert): Promise<void> {
    throw new Error('Not implemented');
  }

  async resolveAlerts(_tx: Queryable, _vehicleId: string, _types: AdminAlertType[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
