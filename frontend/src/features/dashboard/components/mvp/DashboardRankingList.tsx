import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardRankingItem } from '@/features/dashboard/types/dashboard';

interface DashboardRankingListProps {
  title: string;
  description: string;
  items: DashboardRankingItem[];
}

export const DashboardRankingList: React.FC<DashboardRankingListProps> = ({
  title,
  description,
  items,
}) => {
  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.experimentId}
            className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-400 dark:text-slate-500">#{index + 1}</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.experimentName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">created: {item.createdAt.slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={item.status === 'active' ? 'default' : item.status === 'draft' ? 'outline' : 'secondary'}>
                {item.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
