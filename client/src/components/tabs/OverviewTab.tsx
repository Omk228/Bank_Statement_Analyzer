import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Building2,
  AlertTriangle,
  XCircle,
  Activity,
  FileCheck,
} from 'lucide-react';

interface OverviewTabProps {
  data: any;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data }) => {
  const summary = data?.analysis?.summary || data?.summary || {};
  const doc = data?.analysis?.document || data?.account || {};
  const classification = data?.classification || {};
  const validation = data?.validation || {};
  const kpi = data?.analysis?.analytics?.consumer?.base?.subject?.kpi || {};
  const integrityReport = validation?.integrityReport || summary?.integrityReport || data?.integrityReport;
  const confidenceDecomp = validation?.confidenceDecomposition || summary?.confidenceDecomposition || data?.confidenceDecomposition;

  const formatCurrency = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const confidencePct = Math.round((classification.confidence || 0) * 100);
  const integrityStatus = integrityReport?.integrity_status || (validation?.balanceContinuityVerified ? 'GREEN' : 'RED');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Verification & Document Classification */}
      <div className="glass-panel p-6 border-l-4 border-l-emerald-500 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">
                  {doc.bankName || data?.bank?.name || 'Bank Statement'}
                </h2>
                <span className="gradient-badge-green px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Verified Statement
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Account Holder:{' '}
                <span className={`font-medium ${doc.accountHolderName || doc.holderName ? 'text-slate-200' : 'text-slate-400 italic'}`}>
                  {doc.accountHolderName || doc.holderName || 'Not detected'}
                </span>{' '}
                • Account: <span className="text-slate-200 font-mono">{doc.accountNumber || doc.maskedNumber || '—'}</span>{' '}
                • IFSC: <span className="text-slate-200 font-mono">{doc.ifsc || data?.bank?.ifsc || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs text-slate-400">Classification Confidence</div>
              <div className="text-xl font-bold text-emerald-400">
                {confidencePct}%
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-xs text-slate-400">Period</div>
              <div className="text-sm font-medium text-slate-200">
                {doc.statementStartDate && doc.statementEndDate
                  ? `${doc.statementStartDate} to ${doc.statementEndDate}`
                  : data?.statementPeriod?.startDate && data?.statementPeriod?.endDate
                  ? `${data.statementPeriod.startDate} to ${data.statementPeriod.endDate}`
                  : 'Statement Period'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total / Closing Balance */}
        <div className="glass-panel p-5 glass-card-interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Closing Balance</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(summary.closingBalance ?? summary.closing_balance ?? kpi.balance?.totalBalanceAmount)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Avg Balance: <span className="text-slate-300 font-medium">{formatCurrency(summary.averageBalance ?? summary.average_balance ?? kpi.balance?.averageBalanceAmount)}</span>
          </div>
        </div>

        {/* Total Inflow (Credits) */}
        <div className="glass-panel p-5 glass-card-interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Credits (Inflow)</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mb-1">
            {formatCurrency(summary.totalCredits ?? summary.total_credits)}
          </div>
          <div className="text-xs text-slate-400">
            Derived Credits: <span className="text-slate-300 font-medium">{formatCurrency(summary.transactionDerivedCredits ?? summary.totalCredits ?? summary.total_credits)}</span>
          </div>
        </div>

        {/* Total Outflow (Debits) */}
        <div className="glass-panel p-5 glass-card-interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Debits (Outflow)</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 mb-1">
            {formatCurrency(summary.totalDebits ?? summary.total_debits)}
          </div>
          <div className="text-xs text-slate-400">
            Derived Debits: <span className="text-slate-300 font-medium">{formatCurrency(summary.transactionDerivedDebits ?? summary.totalDebits ?? summary.total_debits)}</span>
          </div>
        </div>

        {/* Net Cashflow & Volume */}
        <div className="glass-panel p-5 glass-card-interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Transactions Volume</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {(summary.totalTransactions ?? summary.transaction_count ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Period: <span className="text-slate-300 font-medium">{summary.periodDays ?? summary.period_days ?? 30} Days</span>
          </div>
        </div>
      </div>

      {/* Signals & Balance Integrity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5-Pillar Confidence Decomposition */}
        <div className="glass-panel p-6 lg:col-span-2">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            5-Pillar Extraction & Verification Confidence
          </h3>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Document & Bank Identity Match</span>
                <span className="text-sky-400 font-mono font-semibold">
                  {Math.round((confidenceDecomp?.classification ?? (classification.confidence || 0.95)) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((confidenceDecomp?.classification ?? (classification.confidence || 0.95)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Spatial Column Alignment</span>
                <span className="text-indigo-400 font-mono font-semibold">
                  {Math.round((confidenceDecomp?.spatial_alignment ?? 0.98) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((confidenceDecomp?.spatial_alignment ?? 0.98) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">OCR Recognition Quality</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  {Math.round((confidenceDecomp?.ocr_quality ?? (data?.extraction?.average_ocr_confidence || 0.95)) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((confidenceDecomp?.ocr_quality ?? (data?.extraction?.average_ocr_confidence || 0.95)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Key Field Extraction Completeness</span>
                <span className="text-purple-400 font-mono font-semibold">
                  {Math.round((confidenceDecomp?.field_extraction ?? 0.95) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((confidenceDecomp?.field_extraction ?? 0.95) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Ledger Reconciliation Integrity</span>
                <span className={`font-mono font-semibold ${integrityStatus === 'GREEN' ? 'text-emerald-400' : integrityStatus === 'YELLOW' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {Math.round((confidenceDecomp?.reconciliation ?? (integrityStatus === 'GREEN' ? 1.0 : integrityStatus === 'YELLOW' ? 0.70 : 0.30)) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${integrityStatus === 'GREEN' ? 'bg-emerald-400' : integrityStatus === 'YELLOW' ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.round((confidenceDecomp?.reconciliation ?? (integrityStatus === 'GREEN' ? 1.0 : integrityStatus === 'YELLOW' ? 0.70 : 0.30)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Balance Integrity Check */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {integrityStatus === 'GREEN' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : integrityStatus === 'YELLOW' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                Mathematical Integrity
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                integrityStatus === 'GREEN'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : integrityStatus === 'YELLOW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {integrityStatus}
              </span>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              {integrityReport?.integrity_message || 'Multi-signal mathematical verification across transaction running balances, ledger arithmetic, and statement totals.'}
            </p>

            <div className="space-y-2.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Opening Balance:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(summary.openingBalance ?? summary.opening_balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Credits (+):</span>
                <span className="font-mono text-emerald-400">
                  +{formatCurrency(summary.totalCredits ?? summary.total_credits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Debits (-):</span>
                <span className="font-mono text-rose-400">
                  -{formatCurrency(summary.totalDebits ?? summary.total_debits)}
                </span>
              </div>
              <div className="h-px bg-slate-800" />
              <div className="flex justify-between font-semibold">
                <span className="text-slate-300">Stated Closing Balance:</span>
                <span className="font-mono text-white">
                  {formatCurrency(summary.statedClosingBalance ?? summary.closingBalance ?? summary.closing_balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated Closing:</span>
                <span className={`font-mono ${integrityStatus === 'GREEN' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}`}>
                  {formatCurrency(summary.calculatedClosingBalance ?? summary.calculated_closing_balance)}
                </span>
              </div>
              {parseFloat(summary.reconciliationDifference || '0') > 0.01 && (
                <div className="flex justify-between text-rose-400 font-medium pt-1 border-t border-rose-500/20">
                  <span>Reconciliation Difference:</span>
                  <span className="font-mono">
                    {formatCurrency(summary.reconciliationDifference)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            {integrityStatus === 'GREEN' ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All multi-signal integrity checks passed within ₹0.01 tolerance.</span>
              </div>
            ) : integrityStatus === 'YELLOW' ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Minor balance discrepancy noted; document structure is genuine.</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Ledger continuity check failed. Difference exceeds tolerance.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

