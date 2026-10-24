import { z } from 'zod';

export const MAX_INBOX_PAGE = 50;

export const inboxQuerySchema = z.strictObject({
  unread: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(MAX_INBOX_PAGE).default(20),
});

export const notificationIdSchema = z.strictObject({ id: z.uuid('must be a valid id') });

export type InboxQuery = z.infer<typeof inboxQuerySchema>;
