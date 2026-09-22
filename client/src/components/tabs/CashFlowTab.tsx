import React from 'react';
import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';

interface CashFlowTabProps {
  data: any;
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({ data }) => {
  const monthlyAnalysis =
    data?.analysis?.analytics?.consumer?.cashFlow?.monthlyAnalysis || [];

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Find max monthly value for normalized chart scaling
  const maxVal = Math.max(
    ...monthlyAnalysis.map((m: any) =>
      Math.max(m.incomeAmount || 0, Math.abs(m.expensesAmount || 0))
    ),
    1000
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Monthly Cash Flow & Trends</h2>
          <p className="text-xs text-slate-400">
            Historical inflow, outflow, net savings, and minimum balance trajectory
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-slate-300">Inflow (Credits)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-slate-300">Outflow (Debits)</span>
          </div>
        </div>
      </div>

      {monthlyAnalysis.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No monthly cash flow transactions detected in the statement.
        </div>
      ) : (
        <>
          {/* Visual Chart Comparison */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Monthly Volume Comparison
            </h3>

            <div className="space-y-5">
              {monthlyAnalysis.map((m: any, idx: number) => {
                const income = m.incomeAmount || 0;
                const expenses = Math.abs(m.expensesAmount || 0);
                const incomePct = maxVal > 0 ? (income / maxVal) * 100 : 0;
                const expensesPct = maxVal > 0 ? (expenses / maxVal) * 100 : 0;

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300 font-medium">{m.month}</span>
                      <div className="flex gap-4">
                        <span className="text-emerald-400 font-semibold">+{formatCurrency(income)}</span>
                        <span className="text-rose-400 font-semibold">-{formatCurrency(expenses)}</span>
                        <span
                          className={`font-semibold ${
                            m.savingAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          Net: {formatCurrency(m.savingAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 h-3.5 bg-slate-900/60 rounded-lg p-0.5 border border-slate-800">
                      <div className="w-full flex justify-end">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-sm transition-all duration-500"
                          style={{ width: `${Math.min(incomePct, 100)}%` }}
                        />
                      </div>
                      <div className="w-full flex justify-start">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-sm transition-all duration-500"
                          style={{ width: `${Math.min(expensesPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Monthly Cashflow Table */}
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-sm text-white">
              Detailed Monthly Breakdown & Balances
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Month</th>
                    <th className="p-3.5">Income</th>
                    <th className="p-3.5">Expenses</th>
                    <th className="p-3.5">Net Savings</th>
                    <th className="p-3.5">Savings Ratio</th>
                    <th className="p-3.5">Opening Bal</th>
                    <th className="p-3.5">Closing Bal</th>
                    <th className="p-3.5">Avg Bal</th>
                    <th className="p-3.5">Min Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {monthlyAnalysis.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-semibold text-slate-200">{m.month}</td>
                      <td className="p-3.5 text-emerald-400">{formatCurrency(m.incomeAmount)}</td>
                      <td className="p-3.5 text-rose-400">{formatCurrency(m.expensesAmount)}</td>
                      <td
                        className={`p-3.5 font-semibold ${
                          m.savingAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(m.savingAmount)}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {Math.round((m.savingRatio || 0) * 100)}%
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {formatCurrency(m.balance?.openingBalanceAmount)}
                      </td>
                      <td className="p-3.5 text-slate-200">
                        {formatCurrency(m.balance?.closingBalanceAmount)}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {formatCurrency(m.balance?.averageBalanceAmount)}
                      </td>
                      <td className="p-3.5 text-amber-400 font-semibold">
                        {formatCurrency(m.balance?.minimumBalanceAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
