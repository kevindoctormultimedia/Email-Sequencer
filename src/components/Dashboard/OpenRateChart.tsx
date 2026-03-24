'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: { date: string; opens: number; sends: number }[];
}

export default function OpenRateChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Performance (Last 14 Days)</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-600">No email data yet. Start sending!</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="sends" fill="#6366f1" name="Sent" radius={[2, 2, 0, 0]} />
            <Bar dataKey="opens" fill="#22c55e" name="Opens" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
