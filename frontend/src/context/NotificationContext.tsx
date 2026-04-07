import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Notification, NotificationType } from '../types';

interface NotificationContextValue {
  notify: (type: NotificationType, title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const ICONS: Record<NotificationType, ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

function ToastItem({
  notification,
  onRemove,
}: {
  notification: Notification;
  onRemove: (id: string) => void;
}) {
  return (
    <div className={`toast toast--${notification.type}`} role="alert">
      <span className="toast__icon">{ICONS[notification.type]}</span>
      <div className="toast__body">
        <p className="toast__title">{notification.title}</p>
        {notification.message && (
          <p className="toast__message">{notification.message}</p>
        )}
      </div>
      <button
        className="toast__close"
        onClick={() => onRemove(notification.id)}
        aria-label="Đóng thông báo"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (type: NotificationType, title: string, message?: string) => {
      const id = Math.random().toString(36).slice(2);
      const newItem: Notification = { id, type, title, message };
      setNotifications((prev) => [...prev, newItem]);
      setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const portal = createPortal(
    <div className="toast-portal" aria-live="polite">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onRemove={remove} />
      ))}
    </div>,
    document.body
  );

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {portal}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be within NotificationProvider');
  return ctx;
}
