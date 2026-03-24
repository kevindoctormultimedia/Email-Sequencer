'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Sequence {
  id: number;
  name: string;
  website_maker_pattern: string;
  description: string;
  created_at: string;
  contact_count: number;
  step_count: number;
}

interface ParsedEmail {
  stepOrder: number;
  delayDays: number;
  subject: string;
  bodyHtml: string;
}

interface ParsedSequence {
  name: string;
  description: string;
  websiteMakerPattern: string;
  emails: ParsedEmail[];
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [description, setDescription] = useState('');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ParsedSequence | null>(null);
  const [importName, setImportName] = useState('');
  const [importPattern, setImportPattern] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadSequences() {
    fetch('/api/sequences').then(r => r.json()).then(setSequences);
  }

  useEffect(() => { loadSequences(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website_maker_pattern: pattern, description }),
    });
    setName(''); setPattern(''); setDescription('');
    setShowCreate(false);
    loadSequences();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this sequence? Contacts will be unassigned.')) return;
    await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
    loadSequences();
  }

  // Handle file selection and preview
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportSuccess('');
    setImportLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'preview');

      const res = await fetch('/api/sequences/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Preview failed');

      setImportPreview(data.parsed);
      setImportName(data.parsed.name);
      setImportPattern(data.parsed.websiteMakerPattern);
      setImportDescription(data.parsed.description);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse file');
      setImportPreview(null);
    } finally {
      setImportLoading(false);
    }
  }

  // Confirm import
  async function handleImport() {
    if (!importFile) return;

    setImportLoading(true);
    setImportError('');

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('action', 'import');
      formData.append('name', importName);
      formData.append('pattern', importPattern);
      formData.append('description', importDescription);

      const res = await fetch('/api/sequences/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportSuccess(`Imported "${data.name}" with ${data.stepsCreated} email steps`);
      setImportPreview(null);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadSequences();

      // Auto-close after 3s
      setTimeout(() => {
        setShowImport(false);
        setImportSuccess('');
      }, 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  function resetImport() {
    setImportFile(null);
    setImportPreview(null);
    setImportName('');
    setImportPattern('');
    setImportDescription('');
    setImportError('');
    setImportSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sequences</h1>
          <p className="text-gray-700 mt-1">{sequences.length} sequences</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(!showImport); setShowCreate(false); resetImport(); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import Sequence
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowImport(false); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Sequence
          </button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
          <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
            <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Import Sequence from .docx
            </h3>
            <p className="text-sm text-emerald-700 mt-1">
              Upload a Word document with your email sequence. We&apos;ll parse the subject lines, email bodies, and send schedule automatically.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Success Message */}
            {importSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="text-green-800 font-medium">{importSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-red-800">{importError}</span>
              </div>
            )}

            {/* File Upload */}
            {!importPreview && !importSuccess && (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-emerald-300 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-gray-600 font-medium">
                    {importLoading ? 'Parsing document...' : 'Click to upload a .docx file'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Supports documents with labeled emails (e.g. &quot;EMAIL 1 // Day 1&quot;, Subject lines, etc.)
                  </p>
                </label>
                {importLoading && (
                  <div className="mt-4">
                    <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            {importPreview && (
              <div className="space-y-4">
                {/* Editable fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sequence Name</label>
                    <input
                      type="text"
                      value={importName}
                      onChange={e => setImportName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website Maker Pattern</label>
                    <input
                      type="text"
                      value={importPattern}
                      onChange={e => setImportPattern(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. GrowthPlug"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={importDescription}
                      onChange={e => setImportDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Email preview cards */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    {importPreview.emails.length} Emails Detected
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {importPreview.emails.map((email, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                              {email.stepOrder}
                            </span>
                            <span className="font-medium text-gray-900 text-sm">{email.subject}</span>
                          </div>
                          <span className="text-xs text-gray-600">
                            Day {importPreview.emails.slice(0, idx + 1).reduce((sum, e) => sum + e.delayDays, 0)} ({email.delayDays}d delay)
                          </span>
                        </div>
                        <div
                          className="text-xs text-gray-700 line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleImport}
                    disabled={importLoading}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Import {importPreview.emails.length} Emails
                      </>
                    )}
                  </button>
                  <button
                    onClick={resetImport}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Choose Different File
                  </button>
                  <button
                    onClick={() => { setShowImport(false); resetImport(); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Panel */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Sequence</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sequence Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. iMatrix Outreach" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website Maker Pattern (for auto-matching)</label>
              <input type="text" value={pattern} onChange={e => setPattern(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. iMatrix" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sequences.map(seq => (
          <div key={seq.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <Link href={`/sequences/${seq.id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                {seq.name}
              </Link>
              <button onClick={() => handleDelete(seq.id)} className="text-gray-600 hover:text-red-500 text-sm">Delete</button>
            </div>
            {seq.website_maker_pattern && (
              <p className="text-xs text-gray-700 mb-2">Auto-matches: <span className="font-medium">{seq.website_maker_pattern}</span></p>
            )}
            {seq.description && <p className="text-sm text-gray-600 mb-3">{seq.description}</p>}
            <div className="flex gap-4 text-sm text-gray-700">
              <span>{seq.contact_count} contacts</span>
              <span>{seq.step_count} steps</span>
            </div>
            <Link href={`/sequences/${seq.id}`} className="mt-4 block text-sm text-blue-600 hover:underline">
              View Details &rarr;
            </Link>
          </div>
        ))}
        {sequences.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-600">
            No sequences yet. Create one manually or import from a .docx file.
          </div>
        )}
      </div>
    </div>
  );
}
