import { Card, CardContent } from '@/components/ui/card';

interface HealthCardsProps {
  coverageLabel: string;
  missingDayRatioLabel: string;
  schemaViolationLabel: string;
  coverageScore: string;
  missingDayRatio: string;
  schemaViolationCount: string;
}

export const HealthCards = ({
  coverageLabel,
  missingDayRatioLabel,
  schemaViolationLabel,
  coverageScore,
  missingDayRatio,
  schemaViolationCount,
}: HealthCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-slate-500">{coverageLabel}</p><p className="text-xl font-bold mt-2">{coverageScore}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-slate-500">{missingDayRatioLabel}</p><p className="text-xl font-bold mt-2">{missingDayRatio}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-slate-500">{schemaViolationLabel}</p><p className="text-xl font-bold mt-2">{schemaViolationCount}</p></CardContent></Card>
    </div>
  );
};
