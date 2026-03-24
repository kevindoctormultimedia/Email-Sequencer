'use client';

import { useEffect, useState } from 'react';

interface ABTest {
  id: number;
  sequence_step_id: number;
  sequence_name: string;
  step_subject: string;
  variant_name: string;
  subject: string;
  body_html: string;
  status: string;
  sends: number;
  opens: number;
  replies: number;
  created_at: string;
}

interface Insight {
  type: string;
  data: Record<string, unknown>;
  confidence: number;
  sequenceId: number;
}

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  function loadData() {
    Promise.all([
      fetch('/api/ab-tests').then(r => r.json()),
      fetch('/api/ab-tests/insights').then(r => r.json()),
    ]).then(([t, i]) => {
      setTests(t);
      setInsights(i);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function pickWinner(testId: number, useAI: boolean) {
    await fetch(`/api/ab-tests/${testId}/pick-winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_ai: useAI }),
    });
    loadData();
  }

  // Group tests by sequence step
  const grouped = tests.reduce((acc, t) => {
    const key = `${t.sequence_name} - Step: ${t.step_subject}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, ABTest[]>);

  if (loading) return <div className="text-gray-700">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">A/B Tests</h1>
        <p className="text-gray-700 mt-1">Compare email variants and let AI optimize your campaigns</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center text-gray-600">
          No A/B tests yet. Create variants from a sequence step to start testing.
        </div>
      ) : (
        Object.entries(grouped).map(([key, variants]) => (
          <div key={key} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">{key}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants.map(v => (
                <div key={v.id} className={`border rounded-lg p-4 ${
                  v.status === 'winner' ? 'border-green-400 bg-green-50' :
                  v.status === 'loser' ? 'border-red-200 bg-red-50' :
                  'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Variant {v.variant_name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      v.status === 'winner' ? 'bg-green-200 text-green-800' :
                      v.status === 'loser' ? 'bg-red-200 text-red-800' :
                      'bg-blue-100 text-blue-700'
                    }`}>{v.status}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">Subject: {v.subject}</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold text-gray-900">{v.sends}</p>
                      <p className="text-gray-700">Sent</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold text-green-700">{v.sends > 0 ? ((v.opens / v.sends) * 100).toFixed(1) : 0}%</p>
                      <p className="text-gray-700">Open Rate</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold text-purple-700">{v.sends > 0 ? ((v.replies / v.sends) * 100).toFixed(1) : 0}%</p>
                      <p className="text-gray-700">Reply Rate</p>
                    </div>
                  </div>
                  {v.status === 'active' && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => pickWinner(v.id, false)} className="text-xs text-green-600 hover:underline">Pick as Winner</button>
                      <button onClick={() => pickWinner(v.id, true)} className="text-xs text-blue-600 hover:underline">Let AI Decide</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ML Insights Panel */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">ML Insights</h3>
        <p className="text-sm text-gray-700 mb-4">Patterns learned from A/B test results. These are used to generate smarter variants.</p>
        {insights.length === 0 ? (
          <p className="text-gray-600">No insights yet. Run A/B tests to start learning.</p>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">{insight.type}</span>
                <span className="text-gray-700 flex-1">{JSON.stringify(insight.data)}</span>
                <span className="text-gray-600 text-xs">{(insight.confidence * 100).toFixed(0)}% confidence</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
