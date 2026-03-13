import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendCompositeChartProps {
  title: string;
  description: string;
  data: Array<{ date: string; core_activity: number; communication: number; merge_rate: number | null }>;
}

export const TrendCompositeChart = ({ title, description, data }: TrendCompositeChartProps) => {
  const formatDateLabel = (value: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const [year, month, day] = value.split('-');
    const currentYear = String(new Date().getFullYear());

    if (year === currentYear) {
      return `${month}-${day}`;
    }

    return `${year}-${month}-${day}`;
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDateLabel} interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(label) => formatDateLabel(String(label))} />
              <Line type="monotone" dataKey="core_activity" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="communication" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="merge_rate" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
