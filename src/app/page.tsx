'use client';

import { useEffect, useState } from 'react';
import StatsCards from '@/components/Dashboard/StatsCards';
import PipelineOverview from '@/components/Dashboard/PipelineOverview';
import OpenRateChart from '@/components/Dashboard/OpenRateChart';
import ActivityFeed from '@/components/Dashboard/ActivityFeed';

interface Analytics {
  totalContacts: number;
  activeSequences: number;
  emailsSentToday: number;
  avgOpenRate: number;
  avgReplyRate: number;
  avgForwardRate: number;
  recentActivity: { id: number; type: string; description: string; time: string }[];
  opensByDay: { date: string; opens: number; sends: number }[];
}

interface PipelineData {
  sequences: {
    id: number;
    name: string;
    steps: { step_order: number; subject: string; contacts_at_step: number; opened: number; replied: number }[];
    totalContacts: number;
  }[];
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then(r => r.json()),
      fetch('/api/analytics/pipeline').then(r => r.json()),
    ]).then(([a, p]) => {
      setAnalytics(a);
      setPipeline(p);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-700 text-lg">Loading dashboard...</div></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-700 mt-1">Overview of your email marketing performance</p>
      </div>

      <StatsCards
        totalContacts={analytics?.totalContacts || 0}
        activeSequences={analytics?.activeSequences || 0}
        emailsSentToday={analytics?.emailsSentToday || 0}
        avgOpenRate={analytics?.avgOpenRate || 0}
        avgReplyRate={analytics?.avgReplyRate || 0}
        avgForwardRate={analytics?.avgForwardRate || 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <OpenRateChart data={analytics?.opensByDay || []} />
        <ActivityFeed activities={analytics?.recentActivity || []} />
      </div>

      <PipelineOverview sequences={pipeline?.sequences || []} />
    </div>
  );
}
