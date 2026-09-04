import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-lg border border-ink-700 bg-ink-900', className)} {...props} />
);

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('border-b border-ink-700 px-5 py-4', className)} {...props} />
);

export const CardBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 py-4', className)} {...props} />
);

const statusStyles: Record<string, string> = {
  IDEA: 'bg-ink-700 text-ink-500',
  GENERATING: 'bg-signal-amberDim text-signal-amber',
  DRAFT: 'bg-ink-700 text-paper-100',
  REVIEW: 'bg-signal-amberDim text-signal-amber',
  APPROVED: 'bg-ready-mintDim text-ready-mint',
  READY: 'bg-ready-mintDim text-ready-mint',
  SCHEDULED: 'bg-ink-700 text-paper-100',
  PUBLISHED: 'bg-ready-mintDim text-ready-mint',
  FAILED: 'bg-alert-red/20 text-alert-red',
};

export const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
      statusStyles[status] ?? 'bg-ink-700 text-ink-500',
    )}
  >
    {status.replace('_', ' ')}
  </span>
);
