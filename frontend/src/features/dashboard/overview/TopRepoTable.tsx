import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TopRepoTableProps {
  title: string;
  concentrationLabel: string;
  emptyText: string;
  concentration: string;
  rows: Array<{ repo_name: string; events: number; ratio: number }>;
}

export const TopRepoTable = ({ title, concentrationLabel, emptyText, concentration, rows }: TopRepoTableProps) => {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-slate-500">{concentrationLabel}: {concentration}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.length === 0 ? <p className="text-sm text-slate-500">{emptyText}</p> : rows.map((row) => (
            <div key={row.repo_name} className="flex justify-between text-sm">
              <span>{row.repo_name}</span>
              <span>{row.events} ({(row.ratio * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
