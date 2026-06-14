// Import tab — CSV upload + anomaly report display.
// Meera's requirement: "I want to approve anything the app deletes or changes."
// Error-severity anomalies are held as PENDING and shown prominently.

import { useState } from 'react';
import { importApi } from '../../api/import';
import type { ImportReport, ImportAnomaly } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Upload, AlertTriangle, Info, XCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { groupId: string; }

const SEVERITY_CONFIG = {
  info:    { color: 'blue' as const,   icon: <Info className="h-4 w-4 text-blue-500" />,          label: 'Info' },
  warning: { color: 'yellow' as const, icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, label: 'Warning' },
  error:   { color: 'red' as const,    icon: <XCircle className="h-4 w-4 text-red-500" />,          label: 'Error' },
};

export function ImportTab({ groupId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await importApi.uploadCsv(groupId, file);
      setReport(result.report);
      toast.success(`Import complete — ${result.report.summary.imported} rows imported`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Import failed';
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setReport(null); }
  }

  const filteredAnomalies: ImportAnomaly[] = report
    ? report.anomalies.filter((a) => filter === 'all' || a.severity === filter)
    : [];

  return (
    <div>
      {/* Upload form */}
      <form onSubmit={handleUpload} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-medium text-gray-900">Import from CSV</h3>
        <p className="mb-4 text-sm text-gray-500">
          Upload the <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">expenses_export.csv</code> file exactly as provided.
          The importer will detect and report all data anomalies before writing to the database.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose CSV file'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </label>
          <Button type="submit" isLoading={isUploading} disabled={!file}>
            Import
          </Button>
        </div>
      </form>

      {/* Report */}
      {report && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total rows', value: report.summary.totalRows, color: 'gray' },
              { label: 'Imported',   value: report.summary.imported,  color: 'green' },
              { label: 'Skipped',    value: report.summary.skipped,   color: 'yellow' },
              { label: 'Anomalies',  value: report.summary.anomalies, color: 'red' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="mt-1 text-xs text-gray-500">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Pending items warning */}
          {report.summary.pending > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600 shrink-0" />
              <div>
                <p className="font-medium text-yellow-800">
                  {report.summary.pending} row{report.summary.pending !== 1 ? 's' : ''} require your review
                </p>
                <p className="mt-0.5 text-sm text-yellow-700">
                  These rows have conflicting data or percentages that don't sum to 100%.
                  They have been held as PENDING and not imported. Review the anomalies below.
                </p>
              </div>
            </div>
          )}

          {report.summary.pending === 0 && report.summary.imported > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">All rows processed successfully</p>
            </div>
          )}

          {/* Anomaly list */}
          {report.anomalies.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Anomaly Report</h3>
                <div className="flex gap-1.5">
                  {(['all', 'error', 'warning', 'info'] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors
                        ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {f === 'all' ? `All (${report.anomalies.length})` : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredAnomalies.map((anomaly, i) => {
                  const cfg = SEVERITY_CONFIG[anomaly.severity];
                  return (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        {cfg.icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge label={cfg.label} color={cfg.color} />
                            <span className="text-xs font-mono text-gray-500">{anomaly.anomalyCode}</span>
                            <span className="text-xs text-gray-400">Row {anomaly.rowIndex + 1}</span>
                          </div>
                          <p className="mt-1.5 text-sm text-gray-800">{anomaly.description}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            <span className="font-medium">Policy:</span> {anomaly.policy}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            <span className="font-medium">Action:</span> {anomaly.actionTaken}
                          </p>

                          {/* Raw CSV row for full transparency */}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-blue-600 hover:underline">
                              Show raw CSV row
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                              {JSON.stringify(anomaly.csvRow, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
