'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-600">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromName, setFromName] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000');
  const [abSplit, setAbSplit] = useState('50');
  const [abMinSample, setAbMinSample] = useState('30');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // OAuth state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthMessage, setOauthMessage] = useState('');

  // Signature
  const [signature, setSignature] = useState('');
  const [signatureSyncing, setSignatureSyncing] = useState(false);
  const [signatureSyncMsg, setSignatureSyncMsg] = useState('');
  const [showSigSource, setShowSigSource] = useState(false);

  // Rate limits
  const [ratePerMinute, setRatePerMinute] = useState('5');
  const [ratePerHour, setRatePerHour] = useState('50');
  const [ratePerDay, setRatePerDay] = useState('200');
  const [rateDelay, setRateDelay] = useState('15');
  const [rampUpEnabled, setRampUpEnabled] = useState(true);
  const [rampUpDay, setRampUpDay] = useState(0);
  const [sentToday, setSentToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(0);

  useEffect(() => {
    // Load settings
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSmtpEmail(data.smtp_email || '');
      setSmtpPassword(data.smtp_password || '');
      setFromName(data.from_name || '');
      setGeminiKey(data.gemini_api_key || '');
      setBaseUrl(data.app_base_url || 'http://localhost:3000');
      setAbSplit(data.ab_split_pct || '50');
      setAbMinSample(data.ab_min_sample || '30');
      setClientId(data.google_client_id || '');
      setClientSecret(data.google_client_secret || '');
      setSignature(data.email_signature || '');
      setRatePerMinute(data.rate_max_per_minute || '5');
      setRatePerHour(data.rate_max_per_hour || '50');
      setRatePerDay(data.rate_max_per_day || '200');
      setRateDelay(data.rate_delay_between_ms ? (parseInt(data.rate_delay_between_ms) / 1000).toString() : '15');
      setRampUpEnabled(data.rate_ramp_up_enabled !== 'false');
      setRampUpDay(parseInt(data.rate_ramp_up_day || '0'));
    });

    // Check OAuth status
    fetch('/api/auth/status').then(r => r.json()).then(data => {
      setOauthConnected(data.connected);
      setOauthEmail(data.email || '');
    });

    // Load rate limit usage
    fetch('/api/rate-limits').then(r => r.json()).then(data => {
      setSentToday(data.usage?.today || 0);
      setDailyLimit(data.dailyLimit || 0);
    }).catch(() => {});
  }, []);

  // Handle OAuth callback redirect
  useEffect(() => {
    const oauthResult = searchParams.get('oauth');
    if (oauthResult === 'success') {
      const email = searchParams.get('email') || '';
      setOauthConnected(true);
      setOauthEmail(email);
      setOauthMessage(`Gmail connected successfully as ${email}`);
      window.history.replaceState({}, '', '/settings');
    } else if (oauthResult === 'error') {
      const message = searchParams.get('message') || 'Connection failed';
      setOauthMessage(`Error: ${message}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_email: smtpEmail,
          smtp_password: smtpPassword,
          from_name: fromName,
          gemini_api_key: geminiKey,
          app_base_url: baseUrl,
          ab_split_pct: abSplit,
          ab_min_sample: abMinSample,
          google_client_id: clientId,
          google_client_secret: clientSecret,
          email_signature: signature,
          rate_max_per_minute: ratePerMinute,
          rate_max_per_hour: ratePerHour,
          rate_max_per_day: ratePerDay,
          rate_delay_between_ms: (parseFloat(rateDelay) * 1000).toString(),
          rate_ramp_up_enabled: rampUpEnabled.toString(),
        }),
      });
      setStatus('Settings saved successfully!');
    } catch {
      setStatus('Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(''), 3000);
    }
  }

  async function handleConnectGmail() {
    setOauthLoading(true);
    setOauthMessage('');
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_client_id: clientId,
          google_client_secret: clientSecret,
          app_base_url: baseUrl,
        }),
      });
      const res = await fetch('/api/auth/authorize');
      const data = await res.json();
      if (data.error) {
        setOauthMessage(data.error);
        setOauthLoading(false);
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setOauthMessage('Failed to start OAuth flow');
      setOauthLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Gmail? Emails will fall back to SMTP.')) return;
    await fetch('/api/auth/disconnect', { method: 'POST' });
    setOauthConnected(false);
    setOauthEmail('');
    setOauthMessage('Gmail disconnected');
    setTimeout(() => setOauthMessage(''), 3000);
  }

  async function handleStartRampUp() {
    await fetch('/api/rate-limits', { method: 'POST' });
    setRampUpDay(1);
  }

  const rampSchedule = [
    { day: 1, limit: 10 }, { day: 2, limit: 15 }, { day: 3, limit: 25 },
    { day: 4, limit: 35 }, { day: 5, limit: 50 }, { day: 6, limit: 65 },
    { day: 7, limit: 80 }, { day: 8, limit: 100 }, { day: 9, limit: 120 },
    { day: 10, limit: 140 }, { day: 11, limit: 160 }, { day: 12, limit: 180 },
    { day: 13, limit: 200 }, { day: 14, limit: 200 },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-700 mt-1">Configure your email and AI settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gmail OAuth Connection */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-1">Gmail Connection</h3>
          <p className="text-sm text-gray-700 mb-4">Connect your Gmail account to send emails via the Gmail API (recommended)</p>

          {oauthConnected ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Gmail Connected</p>
                    <p className="text-sm text-green-700">{oauthEmail}</p>
                  </div>
                </div>
                <button type="button" onClick={handleDisconnect} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200">
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Gmail Not Connected</p>
                  <p className="text-sm text-gray-700">Add your OAuth credentials below and connect</p>
                </div>
              </div>
            </div>
          )}

          {oauthMessage && (
            <div className={`text-sm mb-4 p-3 rounded-lg ${oauthMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {oauthMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Client ID</label>
              <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="xxxx.apps.googleusercontent.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Client Secret</label>
              <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="GOCSPX-..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender Display Name</label>
              <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Kevin Graham" />
              <p className="text-xs text-gray-600 mt-1">This is the name recipients see (e.g. &quot;Kevin Graham&quot; not &quot;Email Sequencer&quot;)</p>
            </div>

            {!oauthConnected && (
              <button type="button" onClick={handleConnectGmail} disabled={!clientId || !clientSecret || oauthLoading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2">
                {oauthLoading ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>Connecting...</>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8"/>
                    </svg>
                    Connect Gmail Account
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Email Signature */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Email Signature</h3>
            {oauthConnected && (
              <button
                type="button"
                onClick={async () => {
                  setSignatureSyncing(true);
                  setSignatureSyncMsg('');
                  try {
                    const res = await fetch('/api/auth/signature', { method: 'POST' });
                    const data = await res.json();
                    if (data.error) {
                      setSignatureSyncMsg(`Error: ${data.error}`);
                    } else {
                      setSignature(data.signature);
                      setSignatureSyncMsg('Signature synced from Gmail!');
                      setTimeout(() => setSignatureSyncMsg(''), 3000);
                    }
                  } catch {
                    setSignatureSyncMsg('Error: Failed to sync');
                  } finally {
                    setSignatureSyncing(false);
                  }
                }}
                disabled={signatureSyncing}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {signatureSyncing ? (
                  <><div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full"></div>Syncing...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sync from Gmail
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-4">
            {oauthConnected
              ? 'Pull your existing Gmail signature or edit manually below'
              : 'This will be automatically appended to every outgoing email'}
          </p>
          {signatureSyncMsg && (
            <div className={`text-sm mb-3 p-2 rounded-lg ${signatureSyncMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {signatureSyncMsg}
            </div>
          )}
          <div className="space-y-3">
            {signature ? (
              <>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">Signature Preview:</p>
                    <button
                      type="button"
                      onClick={() => setShowSigSource(!showSigSource)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showSigSource ? 'Show Preview' : 'Edit HTML Source'}
                    </button>
                  </div>
                  {showSigSource ? (
                    <textarea
                      value={signature}
                      onChange={e => setSignature(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      rows={8}
                    />
                  ) : (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-sm" dangerouslySetInnerHTML={{ __html: signature }} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { if (confirm('Clear your email signature?')) setSignature(''); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear signature
                </button>
              </>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                {oauthConnected ? (
                  <>
                    <p className="text-gray-700 font-medium">No signature set</p>
                    <p className="text-sm text-gray-600 mt-1">Click &quot;Sync from Gmail&quot; above to pull your existing signature, or paste HTML below</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 font-medium">No signature set</p>
                    <p className="text-sm text-gray-600 mt-1">Connect Gmail first to auto-sync your signature, or paste HTML below</p>
                  </>
                )}
                <textarea
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  className="w-full mt-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  rows={4}
                  placeholder="Paste your HTML signature here..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Spam Safeguards */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-1">Spam Safeguards</h3>
          <p className="text-sm text-gray-700 mb-4">Protect your sender reputation with rate limiting and warm-up</p>

          {/* Current Usage */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Today&apos;s usage</span>
              <span className="text-sm text-gray-700">{sentToday} / {dailyLimit || ratePerDay} emails</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  sentToday / (dailyLimit || parseInt(ratePerDay)) > 0.9 ? 'bg-red-500' :
                  sentToday / (dailyLimit || parseInt(ratePerDay)) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (sentToday / (dailyLimit || parseInt(ratePerDay) || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max emails / minute</label>
              <input type="number" value={ratePerMinute} onChange={e => setRatePerMinute(e.target.value)} min={1} max={20}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max emails / hour</label>
              <input type="number" value={ratePerHour} onChange={e => setRatePerHour(e.target.value)} min={1} max={200}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max emails / day</label>
              <input type="number" value={ratePerDay} onChange={e => setRatePerDay(e.target.value)} min={1} max={500}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay between emails (sec)</label>
              <input type="number" value={rateDelay} onChange={e => setRateDelay(e.target.value)} min={3} max={120}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Warm-Up / Ramp-Up */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Warm-Up Ramp Schedule</h4>
                <p className="text-xs text-gray-700">Gradually increase daily send volume over 2 weeks to build sender reputation</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rampUpEnabled}
                  onChange={e => setRampUpEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </label>
            </div>

            {rampUpEnabled && (
              <div className="space-y-3">
                {rampUpDay === 0 ? (
                  <button
                    type="button"
                    onClick={handleStartRampUp}
                    className="w-full px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
                  >
                    🚀 Start 14-Day Warm-Up (Day 1: 10 emails/day)
                  </button>
                ) : (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 mb-2">
                      Currently on Day {Math.min(rampUpDay, 14)} of 14
                      {rampUpDay >= 14 && ' ✅ Warm-up complete!'}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-7 gap-1">
                  {rampSchedule.map(({ day, limit }) => (
                    <div
                      key={day}
                      className={`text-center p-1.5 rounded text-xs ${
                        day === rampUpDay ? 'bg-blue-100 text-blue-800 font-bold ring-2 ring-blue-400' :
                        day < rampUpDay ? 'bg-green-50 text-green-700' :
                        'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">D{day}</div>
                      <div>{limit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Safety Tips */}
          <div className="mt-4 bg-blue-50 rounded-lg p-4 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">📋 Best Practices to Avoid Spam Flags:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Start with the warm-up ramp — never blast 200+ emails on day 1</li>
              <li>Keep delay between emails at 10-30 seconds for a natural pattern</li>
              <li>Aim for under 50 emails/hour to stay well under Gmail&apos;s radar</li>
              <li>Gmail allows ~500 emails/day — staying at 200 gives you a safety buffer</li>
              <li>Always include an unsubscribe link and your physical address (CAN-SPAM)</li>
              <li>Monitor your bounce rate — over 5% is a red flag</li>
            </ul>
          </div>
        </div>

        {/* SMTP Fallback */}
        <details className="bg-white rounded-xl shadow-sm border border-gray-100">
          <summary className="p-6 cursor-pointer">
            <span className="font-semibold text-gray-900">SMTP Fallback (Optional)</span>
            <span className="text-sm text-gray-700 ml-2">Only needed if not using Gmail OAuth</span>
          </summary>
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gmail Address</label>
              <input type="email" value={smtpEmail} onChange={e => setSmtpEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@gmail.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">App Password</label>
              <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="xxxx xxxx xxxx xxxx" />
              <p className="text-xs text-gray-600 mt-1">Generate at myaccount.google.com &rarr; Security &rarr; App Passwords</p>
            </div>
          </div>
        </details>

        {/* AI Configuration */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">AI Configuration (Gemini)</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
            <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AIza..." />
            <p className="text-xs text-gray-600 mt-1">Get a free key at aistudio.google.com</p>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Application Settings</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (for tracking pixels)</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://localhost:3000" />
            <p className="text-xs text-gray-600 mt-1">Must be publicly accessible for open tracking to work</p>
          </div>
        </div>

        {/* A/B Testing */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">A/B Testing Defaults</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Split % (per variant)</label>
              <input type="number" value={abSplit} onChange={e => setAbSplit(e.target.value)} min={10} max={50}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Sample Size (auto-winner)</label>
              <input type="number" value={abMinSample} onChange={e => setAbMinSample(e.target.value)} min={10}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {status && <span className="text-sm text-green-600">{status}</span>}
        </div>
      </form>
    </div>
  );
}
