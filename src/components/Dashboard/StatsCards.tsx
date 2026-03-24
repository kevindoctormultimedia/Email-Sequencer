interface Props {
  totalContacts: number;
  activeSequences: number;
  emailsSentToday: number;
  avgOpenRate: number;
  avgReplyRate: number;
  avgForwardRate: number;
}

export default function StatsCards({ totalContacts, activeSequences, emailsSentToday, avgOpenRate, avgReplyRate, avgForwardRate }: Props) {
  const cards = [
    { label: 'Total Contacts', value: totalContacts.toLocaleString(), color: 'bg-blue-500' },
    { label: 'Active Sequences', value: activeSequences, color: 'bg-green-500' },
    { label: 'Sent Today', value: emailsSentToday, color: 'bg-purple-500' },
    { label: 'Open Rate', value: `${avgOpenRate.toFixed(1)}%`, color: 'bg-orange-500' },
    { label: 'Reply Rate', value: `${avgReplyRate.toFixed(1)}%`, color: 'bg-teal-500' },
    { label: 'Forward Rate', value: `${avgForwardRate.toFixed(1)}%`, color: 'bg-pink-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className={`w-2 h-2 rounded-full ${card.color} mb-3`} />
          <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          <p className="text-sm text-gray-700 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
