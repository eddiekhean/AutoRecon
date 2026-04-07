import { clsx } from 'clsx';

interface BadgeProps {
  variant: 'active' | 'inactive' | 'admin' | 'sale' | string;
  children: React.ReactNode;
}

const VARIANT_MAP: Record<string, string> = {
  active: 'badge--active',
  inactive: 'badge--inactive',
  ACTIVE: 'badge--active',
  INACTIVE: 'badge--inactive',
  ADMIN: 'badge--admin',
  SALE: 'badge--sale',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={clsx('badge', VARIANT_MAP[variant] ?? 'badge--inactive')}>
      {children}
    </span>
  );
}
