import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardAlert } from '@/features/dashboard/types/overview';

interface AlertListProps {
  title: string;
  emptyText: string;
  alerts: DashboardAlert[];
}

export const AlertList = ({ title, emptyText, alerts }: AlertListProps) => {
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <li key={alert.code} className="text-sm">
                <span className="font-semibold mr-2">[{alert.severity}]</span>{alert.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
