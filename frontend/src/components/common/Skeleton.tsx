import { clsx } from 'clsx';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '16px', className }: SkeletonProps) {
  return (
    <div
      className={clsx('skeleton', className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <Skeleton height="14px" width={i === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}
