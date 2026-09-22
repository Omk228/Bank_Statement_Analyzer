import React from 'react';
import { Repeat, Briefcase, Calendar, CheckCircle2, TrendingUp } from 'lucide-react';

interface RecurringTabProps {
  data: any;
}

export const RecurringTab: React.FC<RecurringTabProps> = ({ data }) => {
  const recurringStreams =
    data?.analysis?.analytics?.consumer?.cashFlow?.insights?.recurringIncomes?.data || [];

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-bold text-white">Recurring Income & Salary Streams</h2>
        <p className="text-xs text-slate-400">
          Identified salary, recurring client deposits, investment credits, and consistency intelligence
        </p>
      </div>

      {recurringStreams.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No recurring monthly employment or salary streams detected in the statement.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recurringStreams.map((stream: any, idx: number) => {
            const isSalary = stream.category === 'RE_05';

            return (
              <div
                key={idx}
                className={`glass-panel p-6 glass-card-interactive border-t-4 ${
                  isSalary ? 'border-t-emerald-500 bg-emerald-500/5' : 'border-t-sky-500'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        isSalary
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {isSalary ? <Briefcase className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {isSalary ? 'Primary Salary / Employment' : 'Recurring Inward Stream'}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono truncate max-w-xs">
                        {stream.descriptionSource}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isSalary ? 'gradient-badge-green' : 'gradient-badge-blue'
                    }`}
                  >
                    {isSalary ? 'Salary Confirmed' : 'Recurring Inflow'}
                  </span>
                </div>

                <div className="my-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Monthly Avg Amount:</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">
                      {formatCurrency(stream.monthlyAverageAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Recurring Source:</span>
                    <span className="text-slate-200 font-semibold uppercase">
                      {stream.recurringOwner?.name || 'Verified Source'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t border-slate-800/80">
                  <div className="p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400 text-[10px] block">Transactions</span>
                    <strong className="text-slate-200 font-mono">
                      {stream.matchedTransactionsCount || stream.matchedTransactions?.length || 0} credits
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400 text-[10px] block">Average Interval</span>
                    <strong className="text-slate-200 font-mono">Every {stream.averageGapDays || 30} days</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400 text-[10px] block">Duration</span>
                    <strong className="text-emerald-400 font-mono">{stream.longevity || 1} months</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
