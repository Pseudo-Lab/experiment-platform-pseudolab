import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@core/ui/cn';
import type { DashboardKpiItem } from '@/features/dashboard/types/dashboard';

interface DashboardKpiCardsProps {
  items: DashboardKpiItem[];
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-xl dark:hover:shadow-indigo-900/10 hover:-translate-y-1 transition-all group rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-wider">
              {item.label}
            </p>
            <div className="flex items-end justify-between mt-3">
              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{item.value}</p>
              {item.changeText ? (
                <p
                  className={cn(
                    'text-xs font-bold px-2 py-1 rounded-full',
                    item.trend === 'up' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                    item.trend === 'down' && 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
                    item.trend === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {item.changeText}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
