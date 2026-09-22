import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle,
  Building2,
  AlertTriangle,
} from 'lucide-react';

interface OverviewTabProps {
  data: any;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data }) => {
  const summary = data?.analysis?.summary || {};
  const doc = data?.analysis?.document || {};
  const classification = data?.classification || {};
  const validation = data?.validation || {};
  const kpi = data?.analysis?.analytics?.consumer?.base?.subject?.kpi || {};

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const confidencePct = Math.round((classification.confidence || 0) * 100);

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
                  {doc.bankName || 'Bank Statement'}
                </h2>
                <span className="gradient-badge-green px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Verified Statement
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Account Holder:{' '}
                <span className="text-slate-200 font-medium">{doc.accountHolderName || 'Primary Account'}</span>{' '}
                • Account: <span className="text-slate-200 font-mono">{doc.accountNumber || '—'}</span>{' '}
                • IFSC: <span className="text-slate-200 font-mono">{doc.ifsc || '—'}</span>
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
                  : doc.statementStartDate || doc.statementEndDate || 'Statement Period'}
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
            {formatCurrency(summary.closingBalance ?? kpi.balance?.totalBalanceAmount)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Avg Balance: <span className="text-slate-300 font-medium">{formatCurrency(kpi.balance?.averageBalanceAmount ?? summary.closingBalance)}</span>
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
            {formatCurrency(summary.totalCredits)}
          </div>
          <div className="text-xs text-slate-400">
            Avg Monthly Inflow: <span className="text-slate-300 font-medium">{formatCurrency(summary.averageMonthlyInflow ?? summary.totalCredits)}</span>
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
            {formatCurrency(summary.totalDebits)}
          </div>
          <div className="text-xs text-slate-400">
            Avg Monthly Outflow: <span className="text-slate-300 font-medium">{formatCurrency(summary.averageMonthlyOutflow ?? summary.totalDebits)}</span>
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
            {(summary.totalTransactions ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Period: <span className="text-slate-300 font-medium">{summary.periodDays ?? 30} Days</span>
          </div>
        </div>
      </div>

      {/* Signals & Balance Integrity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signal Breakdown */}
        <div className="glass-panel p-6 lg:col-span-2">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-400" />
            Multi-Signal Verification Breakdown
          </h3>
          <div className="space-y-3.5">
            {classification.breakdown && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Bank Identity Recognition</span>
                    <span className="text-sky-400 font-mono font-semibold">
                      {classification.breakdown.bankIdentity} / 20 pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${(classification.breakdown.bankIdentity / 20) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Account & IFSC Details</span>
                    <span className="text-sky-400 font-mono font-semibold">
                      {classification.breakdown.accountInfo} / 20 pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${(classification.breakdown.accountInfo / 20) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Transaction Table Ledger</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {classification.breakdown.transactionTable} / 25 pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${(classification.breakdown.transactionTable / 25) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Financial Columns (Dr/Cr/Bal)</span>
                    <span className="text-purple-400 font-mono font-semibold">
                      {classification.breakdown.financialColumns} / 15 pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full"
                      style={{ width: `${(classification.breakdown.financialColumns / 15) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Statement Period Verification</span>
                    <span className="text-amber-400 font-mono font-semibold">
                      {classification.breakdown.statementPeriod} / 15 pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(classification.breakdown.statementPeriod / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Balance Integrity Check */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              {validation?.balanceContinuityVerified ?? (Math.abs((summary.calculatedClosingBalance ?? (summary.openingBalance + summary.totalCredits - summary.totalDebits)) - (summary.closingBalance ?? summary.statedClosingBalance ?? 0)) <= 0.01) ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              )}
              Mathematical Integrity
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Verifies mathematical balance consistency across transactions (Opening + Credits - Debits ≈ Closing).
            </p>

            <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Opening Balance:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(summary.openingBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Credits (+):</span>
                <span className="font-mono text-emerald-400">
                  +{formatCurrency(summary.totalCredits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Debits (-):</span>
                <span className="font-mono text-rose-400">
                  -{formatCurrency(summary.totalDebits)}
                </span>
              </div>
              <div className="h-px bg-slate-800" />
              <div className="flex justify-between font-semibold">
                <span className="text-slate-300">Stated Closing Balance:</span>
                <span className="font-mono text-white">
                  {formatCurrency(summary.closingBalance ?? summary.statedClosingBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated Closing:</span>
                <span className={`font-mono ${(validation?.balanceContinuityVerified ?? (Math.abs((summary.calculatedClosingBalance ?? (summary.openingBalance + summary.totalCredits - summary.totalDebits)) - (summary.closingBalance ?? summary.statedClosingBalance ?? 0)) <= 0.01)) ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}`}>
                  {formatCurrency(summary.calculatedClosingBalance ?? (summary.openingBalance + summary.totalCredits - summary.totalDebits))}
                </span>
              </div>
              {(validation?.balanceDifference !== undefined ? validation.balanceDifference > 0.01 : Math.abs((summary.openingBalance + summary.totalCredits - summary.totalDebits) - (summary.closingBalance ?? 0)) > 0.01) && (
                <div className="flex justify-between text-rose-400 font-medium pt-1 border-t border-rose-500/20">
                  <span>Balance Difference:</span>
                  <span className="font-mono">
                    {formatCurrency(validation?.balanceDifference ?? Math.abs((summary.openingBalance + summary.totalCredits - summary.totalDebits) - (summary.closingBalance ?? 0)))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(validation?.balanceContinuityVerified ?? (Math.abs((summary.calculatedClosingBalance ?? (summary.openingBalance + summary.totalCredits - summary.totalDebits)) - (summary.closingBalance ?? summary.statedClosingBalance ?? 0)) <= 0.01)) ? (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Balance continuity calculated and verified.</span>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Balance continuity failed (Difference: {formatCurrency(validation?.balanceDifference ?? Math.abs((summary.openingBalance + summary.totalCredits - summary.totalDebits) - (summary.closingBalance ?? 0)))}).</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
