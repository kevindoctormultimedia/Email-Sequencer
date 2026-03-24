'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Step {
  id: number;
  step_order: number;
  subject: string;
  body_html: string;
  delay_days: number;
}

interface SequenceDetail {
  id: number;
  name: string;
  website_maker_pattern: string;
  description: string;
  steps: Step[];
  contacts: { id: number; email: string; current_step: number; status: string }[];
  analytics: { step_order: number; sent: number; opened: number; replied: number }[];
}

export default function SequenceDetailPage() {
  const params = useParams();
  const [data, setData] = useState<SequenceDetail | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [delayDays, setDelayDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');

  function loadData() {
    fetch(`/api/sequences/${params.id}`).then(r => r.json()).then(setData);
  }

  useEffect(() => { loadData(); }, [params.id]);

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    const method = editingStep ? 'PUT' : 'POST';
    const body = editingStep
      ? { id: editingStep.id, subject, body_html: bodyHtml, delay_days: delayDays }
      : { subject, body_html: bodyHtml, delay_days: delayDays };

    await fetch(`/api/sequences/${params.id}/steps`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSubject(''); setBodyHtml(''); setDelayDays(1);
    setShowAddStep(false); setEditingStep(null);
    loadData();
  }

  async function handleDeleteStep(stepId: number) {
    await fetch(`/api/sequences/${params.id}/steps`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stepId }),
    });
    loadData();
  }

  function startEdit(step: Step) {
    setEditingStep(step);
    setSubject(step.subject);
    setBodyHtml(step.body_html);
    setDelayDays(step.delay_days);
    setShowAddStep(true);
  }

  async function handleSend() {
    setSending(true);
    setSendResult('');
    try {
      const res = await fetch(`/api/sequences/${params.id}/send`, { method: 'POST' });
      const result = await res.json();
      if (result.error) {
        setSendResult(`Error: ${result.error}`);
      } else {
        setSendResult(`Sent ${result.sent} emails, ${result.skipped} skipped, ${result.errors} errors`);
        loadData();
      }
    } catch {
      setSendResult('Send failed');
    } finally {
      setSending(false);
    }
  }

  if (!data) return <div className="text-gray-700">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{data.name}</h1>
          {data.website_maker_pattern && <p className="text-gray-700 mt-1">Auto-matches: {data.website_maker_pattern}</p>}
          {data.description && <p className="text-gray-700">{data.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingStep(null); setSubject(''); setBodyHtml(''); setDelayDays(1); setShowAddStep(!showAddStep); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add Step
          </button>
          <button onClick={handleSend} disabled={sending || data.steps.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
            {sending ? 'Sending...' : 'Send Emails'}
          </button>
        </div>
      </div>

      {sendResult && <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{sendResult}</div>}

      {/* Add/Edit Step Form */}
      {showAddStep && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{editingStep ? 'Edit Step' : 'Add New Step'}</h3>
          <form onSubmit={handleAddStep} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. {{first_name}}, we noticed your website..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Body (HTML)</label>
              <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} required rows={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="<p>Hi {{first_name}},</p><p>We noticed your website at {{domain}}...</p>" />
              <p className="text-xs text-gray-600 mt-1">Variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{company}}'}, {'{{domain}}'}, {'{{email}}'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay (days after previous step)</label>
              <input type="number" value={delayDays} onChange={e => setDelayDays(Number(e.target.value))} min={0}
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">{editingStep ? 'Update' : 'Add Step'}</button>
              <button type="button" onClick={() => { setShowAddStep(false); setEditingStep(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Steps Pipeline */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Email Steps</h3>
        {data.steps.length === 0 ? (
          <p className="text-gray-600">No steps yet. Add your first email step above.</p>
        ) : (
          <div className="space-y-3">
            {data.steps.map((step, i) => {
              const stats = data.analytics.find(a => a.step_order === step.step_order);
              return (
                <div key={step.id} className="border border-gray-200 rounded-lg p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{step.subject}</p>
                    <p className="text-xs text-gray-700 mt-1">
                      Delay: {step.delay_days} day{step.delay_days !== 1 ? 's' : ''} after previous
                    </p>
                    {stats && (
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-blue-600">{stats.sent} sent</span>
                        <span className="text-green-600">{stats.opened} opened ({stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(0) : 0}%)</span>
                        <span className="text-purple-600">{stats.replied} replied ({stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(0) : 0}%)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(step)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDeleteStep(step.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contacts in Sequence */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Contacts in Sequence ({data.contacts.length})</h3>
        {data.contacts.length === 0 ? (
          <p className="text-gray-600">No contacts assigned to this sequence yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">Email</th>
                  <th className="p-3 text-left font-medium text-gray-600">Current Step</th>
                  <th className="p-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map(c => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="p-3">{c.email}</td>
                    <td className="p-3">{c.current_step || 'Not started'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-700' :
                        c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
