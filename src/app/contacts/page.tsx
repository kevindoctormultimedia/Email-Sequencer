'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface Contact {
  id: number;
  email: string;
  domain: string;
  first_name: string;
  last_name: string;
  company: string;
  website_maker: string;
  website_maker_confidence: number;
  sequence_id: number | null;
  sequence_name: string | null;
  current_step: number;
  status: string;
  created_at: string;
}

interface Sequence {
  id: number;
  name: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [tab, setTab] = useState<'all' | 'review'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkSequenceId, setBulkSequenceId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    fetch('/api/contacts').then(r => r.json()).then(setContacts);
    fetch('/api/sequences').then(r => r.json()).then(setSequences);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const reviewContacts = contacts.filter(c => c.status === 'needs_review');
  const filteredContacts = (tab === 'review' ? reviewContacts : contacts)
    .filter(c => !search || c.email.includes(search) || c.company.includes(search) || (c.website_maker || '').includes(search));

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setImportStatus('Error: Please upload a .csv file');
      return;
    }

    setImporting(true);
    setImportStatus('Uploading and processing...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/contacts/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        setImportStatus(`Error: ${data.error}`);
      } else {
        setImportStatus(`Imported ${data.imported} contacts. ${data.detecting} domains queued for AI detection.`);
        loadData();
      }
    } catch {
      setImportStatus('Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleAssign(contactId: number, sequenceId: string) {
    await fetch(`/api/contacts/${contactId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId ? Number(sequenceId) : null }),
    });
    loadData();
  }

  async function handleBulkAssign() {
    if (!bulkSequenceId || selected.size === 0) return;
    await fetch('/api/contacts/bulk-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: Array.from(selected), sequence_id: Number(bulkSequenceId) }),
    });
    setSelected(new Set());
    setBulkSequenceId('');
    loadData();
  }

  async function handleReview(contactId: number, sequenceId: number) {
    await fetch(`/api/contacts/${contactId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId }),
    });
    loadData();
  }

  async function handleRetriggerDetection(contactId: number) {
    await fetch('/api/detect-maker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId }),
    });
    loadData();
  }

  function toggleSelect(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filteredContacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredContacts.map(c => c.id)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-700 mt-1">{contacts.length} total contacts, {reviewContacts.length} need review</p>
        </div>
      </div>

      {/* Import Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !importing && fileInputRef.current?.click()}
        className={`bg-white rounded-xl shadow-sm border-2 border-dashed transition-all cursor-pointer ${
          dragOver
            ? 'border-blue-400 bg-blue-50 scale-[1.01]'
            : importing
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="p-8 text-center">
          {importing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="text-sm font-medium text-blue-600">Importing contacts...</p>
            </div>
          ) : (
            <>
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${
                dragOver ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <svg className={`w-7 h-7 ${dragOver ? 'text-blue-500' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">
                {dragOver ? 'Drop your CSV here' : 'Drag & drop a CSV file here, or click to browse'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Columns: email (required), first_name, last_name, company
              </p>
            </>
          )}
          {importStatus && (
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              importStatus.startsWith('Error')
                ? 'bg-red-50 text-red-700'
                : importStatus.startsWith('Imported')
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {importStatus.startsWith('Imported') && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {importStatus.startsWith('Error') && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              {importStatus}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('all')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-700 hover:text-gray-700'}`}>
          All Contacts ({contacts.length})
        </button>
        <button onClick={() => setTab('review')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'review' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-700 hover:text-gray-700'}`}>
          Needs Review ({reviewContacts.length})
        </button>
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by email, company, or maker..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selected.size} selected</span>
            <select value={bulkSequenceId} onChange={e => setBulkSequenceId(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Assign to sequence...</option>
              {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={handleBulkAssign} disabled={!bulkSequenceId} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              Assign
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left"><input type="checkbox" onChange={toggleAll} checked={selected.size === filteredContacts.length && filteredContacts.length > 0} /></th>
              <th className="p-3 text-left font-medium text-gray-600">Email</th>
              <th className="p-3 text-left font-medium text-gray-600">Name</th>
              <th className="p-3 text-left font-medium text-gray-600">Company</th>
              <th className="p-3 text-left font-medium text-gray-600">Website Maker</th>
              <th className="p-3 text-left font-medium text-gray-600">Sequence</th>
              <th className="p-3 text-left font-medium text-gray-600">Step</th>
              <th className="p-3 text-left font-medium text-gray-600">Status</th>
              <th className="p-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                <td className="p-3 font-medium text-gray-900">{c.email}</td>
                <td className="p-3 text-gray-700">{c.first_name} {c.last_name}</td>
                <td className="p-3 text-gray-700">{c.company}</td>
                <td className="p-3">
                  {c.website_maker ? (
                    <span className="inline-flex items-center gap-1">
                      <span>{c.website_maker}</span>
                      <span className="text-xs text-gray-600">({(c.website_maker_confidence * 100).toFixed(0)}%)</span>
                    </span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="p-3">
                  {tab === 'review' ? (
                    <select
                      onChange={e => e.target.value && handleReview(c.id, Number(e.target.value))}
                      className="px-2 py-1 border border-gray-200 rounded text-xs"
                      defaultValue=""
                    >
                      <option value="">Assign sequence...</option>
                      {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <select
                      value={c.sequence_id || ''}
                      onChange={e => handleAssign(c.id, e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded text-xs"
                    >
                      <option value="">None</option>
                      {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="p-3 text-gray-600">{c.current_step || '-'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.status === 'active' ? 'bg-green-100 text-green-700' :
                    c.status === 'needs_review' ? 'bg-orange-100 text-orange-700' :
                    c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="p-3">
                  {c.status === 'needs_review' && (
                    <button onClick={() => handleRetriggerDetection(c.id)} className="text-xs text-blue-600 hover:underline">
                      Re-detect
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-600">
                {tab === 'review' ? 'No contacts need review' : 'No contacts yet. Import a CSV to get started.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
