import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface KpiStripProps {
  items: Array<{ label: string; value: string; tooltip?: string }>;
}

export const KpiStrip = ({ items }: KpiStripProps) => {
  const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-tooltip-root="kpi"]')) return;
      setOpenTooltipIndex(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {items.map((item, index) => (
        <Card key={item.label} className="rounded-2xl">
          <CardContent className="p-4 relative">
            <p data-tooltip-root="kpi" className="text-xs text-slate-500 inline-flex items-center gap-1 group relative">
              <span>{item.label}</span>
              {item.tooltip ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenTooltipIndex(openTooltipIndex === index ? null : index)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 cursor-pointer sm:cursor-help"
                    aria-label={`${item.label} description`}
                  >
                    ?
                  </button>

                  <span className="pointer-events-none absolute left-0 top-5 z-20 hidden min-w-[180px] w-max max-w-[280px] break-keep whitespace-normal rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 shadow-lg sm:group-hover:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {item.tooltip}
                  </span>
                </>
              ) : null}
            </p>

            {item.tooltip && openTooltipIndex === index ? (
              <div className="absolute left-4 top-10 z-20 min-w-[180px] w-max max-w-[280px] break-keep whitespace-normal rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 shadow-lg sm:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {item.tooltip}
              </div>
            ) : null}

            <p className="text-2xl font-bold mt-2">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
