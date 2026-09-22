import React from 'react';
import { AlertOctagon, Landmark, DollarSign, XCircle, ShieldCheck } from 'lucide-react';

interface RiskTabProps {
  data: any;
}

export const RiskTab: React.FC<RiskTabProps> = ({ data }) => {
  const risk = data?.analysis?.analytics?.consumer?.risk || {};
  const loan = risk.indebtedness?.loanInstalment || {};
  const cash = risk.cash?.withdrawal || {};
  const directDebit = risk.unsuccessfulDirectDebit?.chargeBack || {};

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.abs(val));
  };

  const incomeRatioPct = Math.round((risk.indebtedness?.incomeRatio || 0) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-bold text-white">Risk & Indebtedness Profile</h2>
        <p className="text-xs text-slate-400">
          Loan servicing capacity, cash withdrawal reliance, and debit return metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Loan Indebtedness */}
        <div className="glass-panel p-6 glass-card-interactive">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Landmark className="w-6 h-6" />
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                incomeRatioPct > 40 ? 'gradient-badge-amber' : 'gradient-badge-green'
              }`}
            >
              {incomeRatioPct > 40 ? 'High EMI' : 'Low Risk'} ({incomeRatioPct}%)
            </span>
          </div>

          <h3 className="text-base font-bold text-white mb-1">Loan Servicing (EMI)</h3>
          <p className="text-xs text-slate-400 mb-4">
            Monthly commitment towards loan installments vs total income.
          </p>

          <div className="space-y-2.5 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Monthly Avg EMI:</span>
              <span className="text-rose-400 font-semibold">{formatCurrency(loan.monthlyAverageTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Total Repaid (Period):</span>
              <span className="text-slate-200">{formatCurrency(loan.periodTotalTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Installments Count:</span>
              <span className="text-slate-200">{loan.periodTotalTransactionsCount ?? 0} payments</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">EMI to Income Ratio:</span>
              <span className="text-emerald-400 font-semibold">{incomeRatioPct}%</span>
            </div>
          </div>
        </div>

        {/* Cash Withdrawal Dependency */}
        <div className="glass-panel p-6 glass-card-interactive">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="gradient-badge-blue px-2.5 py-0.5 rounded-full text-xs font-semibold">
              {cash.periodTotalTransactionsCount ? `${cash.periodTotalTransactionsCount} Withdrawals` : 'No Cash Outflows'}
            </span>
          </div>

          <h3 className="text-base font-bold text-white mb-1">Cash Withdrawals</h3>
          <p className="text-xs text-slate-400 mb-4">
            ATM & branch cash withdrawal frequency and volume analysis.
          </p>

          <div className="space-y-2.5 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Monthly Avg Withdrawal:</span>
              <span className="text-slate-200">{formatCurrency(cash.monthlyAverageTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Total Cash Withdrawn:</span>
              <span className="text-slate-200">{formatCurrency(cash.periodTotalTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Withdrawals Count:</span>
              <span className="text-slate-200">{cash.periodTotalTransactionsCount ?? 0} times</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Cash Outflow Share:</span>
              <span className="text-emerald-400 font-semibold">
                {data?.analysis?.summary?.totalDebits > 0
                  ? `${Math.round(((cash.periodTotalTransactionsAmount || 0) / data.analysis.summary.totalDebits) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Unsuccessful Direct Debits & Bounces */}
        <div className="glass-panel p-6 glass-card-interactive">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-6 h-6" />
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                (directDebit.periodTotalTransactionsCount ?? 0) > 0 ? 'gradient-badge-amber' : 'gradient-badge-green'
              }`}
            >
              {directDebit.periodTotalTransactionsCount ?? 0} Returns
            </span>
          </div>

          <h3 className="text-base font-bold text-white mb-1">Direct Debit / NACH Returns</h3>
          <p className="text-xs text-slate-400 mb-4">
            Analysis of chargebacks, bounced auto-debits, or ECS payment returns.
          </p>

          <div className="space-y-2.5 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Total Return Amount:</span>
              <span className="text-amber-400 font-semibold">{formatCurrency(directDebit.periodTotalTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Monthly Avg Returns:</span>
              <span className="text-slate-200">{formatCurrency(directDebit.monthlyAverageTransactionsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Total Return Count:</span>
              <span className="text-amber-400">{directDebit.periodTotalTransactionsCount ?? 0} instances</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Risk Assessment:</span>
              <span className="text-slate-300">
                {(directDebit.periodTotalTransactionsCount ?? 0) === 0 ? 'Clear / No Mandate Failures' : 'Attention Required'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
