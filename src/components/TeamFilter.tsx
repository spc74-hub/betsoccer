'use client';

import { TeamFilter as TeamFilterType } from '@/types';
import { cn } from '@/lib/utils';

interface TeamFilterProps {
  value: TeamFilterType;
  onChange: (value: TeamFilterType) => void;
}

const filters: { value: TeamFilterType; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'real-madrid', label: 'Real Madrid' },
  { value: 'barcelona', label: 'Barcelona' },
];

export function TeamFilter({ value, onChange }: TeamFilterProps) {
  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            value === filter.value
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
