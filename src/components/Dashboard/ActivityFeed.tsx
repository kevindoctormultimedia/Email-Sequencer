interface Props {
  activities: { id: number; type: string; description: string; time: string }[];
}

const typeColors: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  opened: 'bg-green-100 text-green-700',
  replied: 'bg-purple-100 text-purple-700',
  forwarded: 'bg-orange-100 text-orange-700',
  imported: 'bg-gray-100 text-gray-700',
};

export default function ActivityFeed({ activities }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-600">No activity yet</div>
      ) : (
        <div className="space-y-3 max-h-[250px] overflow-y-auto">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[a.type] || 'bg-gray-100 text-gray-600'}`}>
                {a.type}
              </span>
              <span className="text-gray-700 flex-1">{a.description}</span>
              <span className="text-gray-600 text-xs whitespace-nowrap">{a.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
