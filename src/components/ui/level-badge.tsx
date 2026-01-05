import { cn } from '@/lib/utils';

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface LevelBadgeProps {
  level: Level | string;
  className?: string;
  showLabel?: boolean;
}

const levelLabels: Record<Level, string> = {
  A1: '초급',
  A2: '초중급',
  B1: '중급',
  B2: '중고급',
  C1: '고급',
  C2: '최고급',
};

export function LevelBadge({ level, className, showLabel = false }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        'level-badge',
        {
          'level-a1': level === 'A1',
          'level-a2': level === 'A2',
          'level-b1': level === 'B1',
          'level-b2': level === 'B2',
          'level-c1': level === 'C1',
          'level-c2': level === 'C2',
        },
        className
      )}
    >
      {level}
      {showLabel && levelLabels[level as Level] && ` (${levelLabels[level as Level]})`}
    </span>
  );
}
