import React from 'react';
import { OverviewPage } from '@/features/dashboard/overview/OverviewPage';
import type { DashboardLang } from '@/features/dashboard/types/overview';

interface DashboardProps {
  lang: DashboardLang;
}

export const Dashboard: React.FC<DashboardProps> = ({ lang }) => {
  return <OverviewPage lang={lang} />;
};
