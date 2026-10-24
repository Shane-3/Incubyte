import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AppNotification } from '../api/types';
import { Popover } from '../components/ui/Popover';
import { formatRelative } from '../lib/format';
import { noticeText } from './text';
import { useInbox, useMarkAllRead, useMarkRead } from './useInbox';

function NoticeItem({ notice, onOpen }: { notice: AppNotification; onOpen: (n: AppNotification) => void }) {
  const unread = notice.readAt === null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notice)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-transparent'}`}
        />
        <span className="min-w-0 flex-1">
          <span className={`block ${unread ? 'font-medium text-text' : 'text-muted'}`}>{noticeText(notice)}</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            {unread && <span className="sr-only">Unread.</span>}
            <time dateTime={notice.createdAt}>{formatRelative(notice.createdAt)}</time>
            {notice.resolvedAt && <span className="rounded-full border border-border px-1.5 leading-4">Restocked</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Top-bar bell with an unread badge; opens a panel of the latest notices, newest first. */
export function NotificationBell() {
  const inbox = useInbox();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const lastUnread = useRef<number | null>(null);

  const unread = inbox.data?.unreadCount ?? 0;
  const notices = inbox.data?.data ?? [];

  // Politely announce new arrivals between polls (not on first load).
  useEffect(() => {
    if (inbox.data === undefined) return;
    if (lastUnread.current !== null && unread > lastUnread.current) {
      const fresh = unread - lastUnread.current;
      setAnnouncement(fresh === 1 ? '1 new notification' : `${fresh} new notifications`);
    }
    lastUnread.current = unread;
  }, [inbox.data, unread]);

  function openNotice(notice: AppNotification) {
    if (notice.readAt === null) markRead.mutate(notice.id);
    setOpen(false);
    const params = new URLSearchParams({ make: notice.vehicle.make, model: notice.vehicle.model });
    navigate(`/?${params.toString()}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-8 items-center justify-center rounded-control text-text hover:bg-surface-hover"
      >
        <Bell aria-hidden="true" className="size-4" strokeWidth={1.5} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-on-accent tabular-nums"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {open && (
        <Popover label="Notifications" onClose={() => setOpen(false)} className="w-[min(360px,calc(100vw-32px))]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded-control px-1.5 py-0.5 text-sm text-accent hover:bg-surface-hover"
              >
                Mark all read
              </button>
            )}
          </div>
          {notices.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No notifications</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notices.map((n) => (
                <NoticeItem key={n.id} notice={n} onOpen={openNotice} />
              ))}
            </ul>
          )}
        </Popover>
      )}
    </div>
  );
}
