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
  const [showPreview, setShowPreview] = useState(false);
  const [previews, setPreviewData] = useState<{
    sequenceName: string;
    totalContacts: number;
    previewCount: number;
    previews: {
      contactId: number;
      contactEmail: string;
      contactName: string;
      stepOrder: number;
      stepId: number;
      subject: string;
      body: string;
      rawBody: string;
      fromName: string;
      fromEmail: string;
      hasUnresolvedVars: boolean;
    }[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [editedEmails, setEditedEmails] = useState<Record<number, { subject: string; body: string }>>({});
  const [editingBody, setEditingBody] = useState(false);
  const [selectedForSend, setSelectedForSend] = useState<Set<number>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());

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

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewIndex(0);
    setEditedEmails({});
    setEditingBody(false);
    try {
      const res = await fetch(`/api/sequences/${params.id}/preview`);
      const result = await res.json();
      if (result.error) {
        setSendResult(`Error: ${result.error}`);
      } else {
        // Initialize editable state for each email
        const edits: Record<number, { subject: string; body: string }> = {};
        result.previews.forEach((p: { subject: string; body: string }, i: number) => {
          edits[i] = { subject: p.subject, body: p.body };
        });
        setEditedEmails(edits);
        // Select all by default
        setSelectedForSend(new Set(result.previews.map((_: unknown, i: number) => i)));
        setPreviewData(result);
        setShowPreview(true);
      }
    } catch {
      setSendResult('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewSelected() {
    setPreviewLoading(true);
    setPreviewIndex(0);
    setEditedEmails({});
    setEditingBody(false);
    try {
      const contactIds = Array.from(selectedContacts).join(',');
      const res = await fetch(`/api/sequences/${params.id}/preview?contact_ids=${contactIds}`);
      const result = await res.json();
      if (result.error) {
        setSendResult(`Error: ${result.error}`);
      } else {
        const filtered = result;
        const edits: Record<number, { subject: string; body: string }> = {};
        filtered.previews.forEach((p: { subject: string; body: string }, i: number) => {
          edits[i] = { subject: p.subject, body: p.body };
        });
        setEditedEmails(edits);
        setSelectedForSend(new Set(filtered.previews.map((_: unknown, i: number) => i)));
        setPreviewData(filtered);
        setShowPreview(true);
      }
    } catch {
      setSendResult('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateEditedEmail(index: number, field: 'subject' | 'body', value: string) {
    setEditedEmails(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }));
  }

  async function handleSendConfirmed() {
    if (!previews) return;
    setShowPreview(false);
    setSending(true);
    setSendResult('');
    try {
      // Build emails with edited content — only send selected
      const emails = previews.previews
        .filter((_, i) => selectedForSend.has(i))
        .map((p, i) => {
          const origIndex = previews.previews.indexOf(p);
          return {
            contactId: p.contactId,
            stepId: p.stepId,
            contactEmail: p.contactEmail,
            subject: editedEmails[origIndex]?.subject || p.subject,
            body: editedEmails[origIndex]?.body || p.body,
          };
        });

      const res = await fetch(`/api/sequences/${params.id}/send-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const result = await res.json();
      if (result.error) {
        setSendResult(`Error: ${result.error}`);
      } else {
        setSendResult(`Sent ${result.sent} emails, ${result.errors} errors`);
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
          <button onClick={handlePreview} disabled={sending || previewLoading || data.steps.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
            {previewLoading ? 'Loading Preview...' : sending ? 'Sending...' : 'Preview & Send'}
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

      {/* Email Preview Modal */}
      {showPreview && previews && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Email Preview</h2>
                <p className="text-sm text-gray-600">
                  {previews.previewCount} email{previews.previewCount !== 1 ? 's' : ''} ready to send
                </p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            {previews.previewCount === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-700 font-medium">No emails to send right now</p>
                <p className="text-sm text-gray-600 mt-1">All contacts are either completed, waiting for their delay period, or already received this step.</p>
                <button onClick={() => setShowPreview(false)} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Close</button>
              </div>
            ) : (
              <>
                {/* Two-panel layout: contact list left, preview right */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Left: Contact list with checkboxes */}
                  <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recipients</span>
                      <button
                        onClick={() => {
                          if (selectedForSend.size === previews.previewCount) {
                            setSelectedForSend(new Set());
                          } else {
                            setSelectedForSend(new Set(previews.previews.map((_, i) => i)));
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {selectedForSend.size === previews.previewCount ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {previews.previews.map((p, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewIndex(i)}
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-50 text-sm ${
                            previewIndex === i ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedForSend.has(i)}
                            onChange={e => {
                              e.stopPropagation();
                              const next = new Set(selectedForSend);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              setSelectedForSend(next);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            {p.contactName && <p className="font-medium text-gray-900 truncate text-xs">{p.contactName}</p>}
                            <p className="text-gray-600 truncate text-xs">{p.contactEmail}</p>
                            <p className="text-gray-400 text-xs">Step #{p.stepOrder}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                {/* Right: Email Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {(() => {
                    const email = previews.previews[previewIndex];
                    if (!email) return null;
                    return (
                      <div className="space-y-4">
                        {/* Warning if unresolved variables */}
                        {email.hasUnresolvedVars && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            ⚠️ This email may have unresolved template variables. Check that contact data is complete.
                          </div>
                        )}

                        {/* Email Header */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex">
                            <span className="w-20 text-gray-600 font-medium">From:</span>
                            <span className="text-gray-900">{email.fromName || 'Not set'} {email.fromEmail ? `<${email.fromEmail}>` : '— Set your name in Settings'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-20 text-gray-600 font-medium">To:</span>
                            <span className="text-gray-900">{email.contactName ? `${email.contactName} <${email.contactEmail}>` : email.contactEmail}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-20 text-gray-600 font-medium flex-shrink-0">Subject:</span>
                            <input
                              type="text"
                              value={editedEmails[previewIndex]?.subject ?? email.subject}
                              onChange={e => updateEditedEmail(previewIndex, 'subject', e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded text-gray-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex">
                            <span className="w-20 text-gray-600 font-medium">Step:</span>
                            <span className="text-gray-900">#{email.stepOrder}</span>
                          </div>
                        </div>

                        {/* Email Body Preview - Editable */}
                        <div className="border border-gray-200 rounded-lg">
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">EMAIL BODY PREVIEW</span>
                            <button
                              type="button"
                              onClick={() => setEditingBody(!editingBody)}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              {editingBody ? 'Show Preview' : 'Edit Body'}
                            </button>
                          </div>
                          {editingBody ? (
                            <textarea
                              value={editedEmails[previewIndex]?.body ?? email.body}
                              onChange={e => updateEditedEmail(previewIndex, 'body', e.target.value)}
                              className="w-full p-4 text-sm font-mono leading-relaxed focus:outline-none min-h-[300px] text-gray-900"
                              style={{ resize: 'vertical' }}
                            />
                          ) : (
                            <div
                              className="p-6 text-sm leading-relaxed text-gray-900"
                              style={{ fontFamily: 'Arial, sans-serif', color: '#111' }}
                              dangerouslySetInnerHTML={{ __html: editedEmails[previewIndex]?.body ?? email.body }}
                            />
                          )}
                        </div>
                        {editingBody && (
                          <p className="text-xs text-gray-600">Editing HTML directly. Supports HTML tags for formatting. Changes apply only to this recipient.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
                </div>{/* end two-panel */}

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50 rounded-b-2xl">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {selectedForSend.size} of {previews.previewCount} selected
                    </span>
                    <button
                      onClick={handleSendConfirmed}
                      disabled={selectedForSend.size === 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-bold shadow-sm"
                    >
                      ✓ Send {selectedForSend.size} Email{selectedForSend.size !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Contacts in Sequence */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Contacts in Sequence ({data.contacts.length})</h3>
          {selectedContacts.size > 0 && (
            <button
              onClick={handlePreviewSelected}
              disabled={previewLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {previewLoading ? 'Loading...' : `Preview & Send (${selectedContacts.size})`}
            </button>
          )}
        </div>
        {data.contacts.length === 0 ? (
          <p className="text-gray-600">No contacts assigned to this sequence yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      onChange={() => {
                        if (selectedContacts.size === data.contacts.length) {
                          setSelectedContacts(new Set());
                        } else {
                          setSelectedContacts(new Set(data.contacts.map(c => c.id)));
                        }
                      }}
                      checked={selectedContacts.size === data.contacts.length && data.contacts.length > 0}
                    />
                  </th>
                  <th className="p-3 text-left font-medium text-gray-700">Email</th>
                  <th className="p-3 text-left font-medium text-gray-700">Current Step</th>
                  <th className="p-3 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map(c => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selectedContacts.has(c.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(c.id)}
                        onChange={() => {
                          const next = new Set(selectedContacts);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          setSelectedContacts(next);
                        }}
                      />
                    </td>
                    <td className="p-3 text-gray-900 font-medium">{c.email}</td>
                    <td className="p-3 text-gray-900">{c.current_step || 'Not started'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-700' :
                        c.status === 'needs_review' ? 'bg-orange-100 text-orange-700' :
                        c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-900'
                      }`}>{c.status === 'needs_review' ? 'Needs Review' : c.status}</span>
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
