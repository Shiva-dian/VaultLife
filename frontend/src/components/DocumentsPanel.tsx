import React, { useState, useEffect, useCallback, useRef } from 'react';
import { documentsApi } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────
interface VaultDocument {
  id: string; module: string; record_id: string;
  doc_type: string; doc_label: string | null;
  file_name: string; file_size_bytes: number;
  mime_type: string; storage_url: string | null;
  notes: string | null; created_at: string;
}

interface DocumentsPanelProps {
  module: string;
  recordId: string;
  recordLabel?: string;  // e.g. "HDFC Bank Savings"
  accentColor?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'violet';
}

// ── Constants at MODULE level ─────────────────────────────────────
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOC_TYPES: [string, string][] = [
  ['other',                  'General Document'],
  ['bank_statement',         'Bank Statement'],
  ['passbook',               'Passbook'],
  ['fixed_deposit_receipt',  'FD Receipt'],
  ['demat_statement',        'Demat Statement'],
  ['mutual_fund_statement',  'Mutual Fund Statement'],
  ['holdings_report',        'Holdings Report'],
  ['purchase_invoice',       'Purchase Invoice'],
  ['valuation_certificate',  'Valuation Certificate'],
  ['assay_report',           'Assay / Purity Report'],
  ['policy_document',        'Policy Document'],
  ['premium_receipt',        'Premium Receipt'],
  ['sale_deed',              'Sale Deed'],
  ['patta_copy',             'Patta Copy'],
  ['encumbrance_certificate','Encumbrance Certificate'],
  ['khata_extract',          'Khata Extract'],
  ['tax_receipt',            'Tax Receipt'],
  ['registered_document',    'Registered Document'],
  ['gps_image',              'GPS / Location Image'],
  ['loan_agreement',         'Loan Agreement'],
  ['repayment_schedule',     'Repayment Schedule'],
  ['noc',                    'NOC'],
  ['aadhaar_copy',           'Aadhaar Copy'],
  ['pan_copy',               'PAN Copy'],
];

const MIME_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️', 'image/jpg': '🖼️', 'image/png': '🖼️', 'image/webp': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
};

const ACCENT_COLORS = {
  blue:    { btn:'bg-blue-600 hover:bg-blue-700',   border:'border-blue-300 hover:border-blue-400', badge:'bg-blue-100 text-blue-700' },
  emerald: { btn:'bg-emerald-600 hover:bg-emerald-700', border:'border-emerald-300 hover:border-emerald-400', badge:'bg-emerald-100 text-emerald-700' },
  amber:   { btn:'bg-amber-600 hover:bg-amber-700', border:'border-amber-300 hover:border-amber-400', badge:'bg-amber-100 text-amber-700' },
  indigo:  { btn:'bg-indigo-600 hover:bg-indigo-700', border:'border-indigo-300 hover:border-indigo-400', badge:'bg-indigo-100 text-indigo-700' },
  violet:  { btn:'bg-violet-600 hover:bg-violet-700', border:'border-violet-300 hover:border-violet-400', badge:'bg-violet-100 text-violet-700' },
};

const fmtSize = (bytes: number): string => {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Component ─────────────────────────────────────────────────────
const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  module, recordId, recordLabel, accentColor = 'blue',
}) => {
  const [docs, setDocs]           = useState<VaultDocument[]>([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType]     = useState('other');
  const [docLabel, setDocLabel]   = useState('');
  const [docNotes, setDocNotes]   = useState('');
  const [fileError, setFileError] = useState('');
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const colors = ACCENT_COLORS[accentColor];

  const toast$ = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const r = await documentsApi.getAll({ module, recordId });
      setDocs(r.data.data.documents);
    } catch {
      // silent — panel is secondary UI
    } finally { setLoading(false); }
  }, [module, recordId]);

  useEffect(() => { load(); }, [load]);

  // ── File selection & validation ─────────────────────────────────
  const handleFileSelect = (file: File | null) => {
    setFileError('');
    if (!file) { setSelectedFile(null); return; }

    // Size check
    if (file.size > MAX_SIZE_BYTES) {
      setFileError(`File too large: ${fmtSize(file.size)}. Maximum allowed is 2 MB.`);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size === 0) {
      setFileError('File appears to be empty.');
      setSelectedFile(null);
      return;
    }

    // MIME check
    const mime = file.type.toLowerCase();
    if (!ALLOWED_MIME.includes(mime)) {
      setFileError(`File type "${file.type}" is not supported. Use PDF, JPG, PNG, WEBP, DOC or DOCX.`);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // Extension check
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`Extension "${ext}" is not allowed.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Auto-set label from filename if empty
    if (!docLabel) {
      setDocLabel(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    }
  };

  // ── Upload ──────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) { setFileError('Please select a file.'); return; }
    setUploading(true);
    try {
      // In production: upload file to S3/Cloudinary first, get URL back
      // For now: store metadata; storage_url would be the CDN URL
      const storageUrl = `local://documents/${module}/${recordId}/${Date.now()}_${selectedFile.name}`;

      await documentsApi.add({
        module,
        recordId,
        docType,
        docLabel: docLabel || selectedFile.name,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        mimeType: selectedFile.type,
        storageUrl,
        notes: docNotes || undefined,
      });

      toast$('success', 'Document saved.');
      setShowForm(false);
      setSelectedFile(null);
      setDocLabel('');
      setDocNotes('');
      setDocType('other');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to save document.';
      toast$('error', msg);
    } finally { setUploading(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove document "${name}"?`)) return;
    try {
      await documentsApi.remove(id);
      toast$('success', 'Document removed.');
      await load();
    } catch { toast$('error', 'Failed to remove.'); }
  };

  // ── Progress bar for file size ──────────────────────────────────
  const sizePercent = selectedFile ? Math.round((selectedFile.size / MAX_SIZE_BYTES) * 100) : 0;
  const sizeColor   = sizePercent > 90 ? 'bg-red-500' : sizePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📎</span>
          <span className="font-semibold text-slate-700 text-sm">Supporting Documents</span>
          {docs.length > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {docs.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFileError(''); }}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all ${colors.btn}`}
        >
          {showForm ? '✕ Cancel' : '+ Upload'}
        </button>
      </div>

      {toast && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-semibold
          ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'success' ? '✅' : '⚠️'} {toast.msg}
        </div>
      )}

      {/* Upload form */}
      {showForm && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          {/* File drop zone */}
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all text-center
                ${selectedFile
                  ? 'border-emerald-300 bg-emerald-50'
                  : `border-slate-200 hover:${colors.border} bg-slate-50 hover:bg-white`}`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">{MIME_ICONS[selectedFile.type] || '📄'}</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{selectedFile.name}</div>
                      <div className="text-xs text-slate-500">{fmtSize(selectedFile.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleFileSelect(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="ml-2 text-red-400 hover:text-red-600 font-bold text-lg"
                    >×</button>
                  </div>
                  {/* Size progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>File size</span>
                      <span className={sizePercent > 90 ? 'text-red-600 font-semibold' : ''}>{sizePercent}% of 2 MB limit</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${sizeColor}`} style={{ width: `${sizePercent}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">📤</div>
                  <div className="text-sm text-slate-500 font-medium">Click to select a file</div>
                  <div className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, WEBP, DOC · Max 2 MB</div>
                </div>
              )}
            </div>
            {fileError && (
              <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                ⚠️ {fileError}
              </div>
            )}
          </div>

          {/* Document type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none focus:border-blue-400"
            >
              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Label / Description</label>
            <input
              type="text"
              value={docLabel}
              onChange={e => setDocLabel(e.target.value)}
              placeholder="e.g. Sale Deed 2023, FD Receipt March"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none focus:border-blue-400 placeholder-slate-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes (optional)</label>
            <input
              type="text"
              value={docNotes}
              onChange={e => setDocNotes(e.target.value)}
              placeholder="Any additional notes"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none focus:border-blue-400 placeholder-slate-400"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all ${colors.btn}`}
          >
            {uploading ? 'Saving...' : '✓ Save Document'}
          </button>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <div className="text-2xl mb-1">📂</div>
          <p className="text-xs">No documents uploaded yet.</p>
          <p className="text-xs mt-0.5">Add invoices, certificates, agreements or photos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all group"
            >
              <span className="text-xl flex-shrink-0">{MIME_ICONS[doc.mime_type] || '📄'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {doc.doc_label || doc.file_name}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400">{doc.file_name}</span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <span className="text-[10px] text-slate-400">{fmtSize(doc.file_size_bytes)}</span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(doc.created_at)}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.storage_url && !doc.storage_url.startsWith('local://') && (
                  <a href={doc.storage_url} target="_blank" rel="noreferrer"
                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs"
                    title="View document"
                  >👁️</a>
                )}
                <button
                  onClick={() => handleDelete(doc.id, doc.file_name)}
                  className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center text-xs"
                  title="Remove document"
                >🗑️</button>
              </div>
              {/* Size badge */}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${colors.badge}`}>
                {fmtSize(doc.file_size_bytes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
