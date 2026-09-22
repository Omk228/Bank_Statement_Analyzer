import React, { useState } from 'react';
import { Tag, PieChart, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface CategoriesTabProps {
  data: any;
}

const CATEGORY_NAMES: Record<string, string> = {
  RE_05: 'Salary / Employment Income',
  RE_17: 'Inward UPI / Bank Transfers',
  RE_07: 'Inward Credit Transfers',
  LO_05: 'Loan Disbursal / Credit',
  ZZ_98: 'Other Inward Credits',
  RE_11: 'Investment Dividends / Returns',
  TF_05: 'Account Verification Credits',
  FD_00: 'Food, Dining & Delivery',
  FD_01: 'Groceries & Supermarkets',
  FD_03: 'Cafes & Fast Food',
  SH_00: 'Shopping & General Retail',
  SH_01: 'Electronics & Gadgets',
  SH_03: 'Apparel & Department Stores',
  BL_01: 'Utility & Mobile Recharge',
  BL_02: 'Rent & Subscriptions',
  LO_03: 'Loan Repayments / EMI',
  HF_05: 'Courier & Logistics Services',
  HF_06: 'Healthcare & Medical',
  IN_03: 'Insurance Premiums',
  TR_07: 'Travel, Fuel & Rides',
  OO_03: 'Outward P2P UPI Transfers',
  OO_02: 'Cash Withdrawal',
  OO_00: 'Bank Charges & SMS Fees',
  ZZ_99: 'General Account Outflows',
  FA_03: 'Mutual Funds / Securities Investments',
};

export const CategoriesTab: React.FC<CategoriesTabProps> = ({ data }) => {
  const [activeType, setActiveType] = useState<'expenses' | 'income'>('expenses');

  const incomeCategories =
    data?.analysis?.analytics?.consumer?.cashFlow?.periodAnalysis?.incomeByCategory || [];
  const expensesCategories =
    data?.analysis?.analytics?.consumer?.cashFlow?.periodAnalysis?.expensesByCategory || [];

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.abs(val));
  };

  const list = activeType === 'expenses' ? expensesCategories : incomeCategories;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Category Analytics</h2>
          <p className="text-xs text-slate-400">
            Categorized spending distribution, stability, and recurrence metrics
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
          <button
            onClick={() => setActiveType('expenses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeType === 'expenses'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Expenses Categories ({expensesCategories.length})
          </button>
          <button
            onClick={() => setActiveType('income')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeType === 'income'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" /> Income Categories ({incomeCategories.length})
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No categorized {activeType} transactions detected in the statement.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((cat: any, idx: number) => {
            const catName = CATEGORY_NAMES[cat.code] || `Category (${cat.code})`;
            const amount = cat.amount?.total || 0;
            const count = cat.count?.total || 0;
            const stability = cat.amount?.stability !== undefined ? Math.round(cat.amount.stability * 100) : 80;

            return (
              <div key={idx} className="glass-panel p-5 glass-card-interactive">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        activeType === 'income'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{catName}</h3>
                      <span className="text-[10px] font-mono text-slate-500">{cat.code}</span>
                    </div>
                  </div>
                </div>

                <div className="my-3">
                  <div className="text-xl font-bold font-mono text-white mb-1">
                    {formatCurrency(amount)}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Count: <strong className="text-slate-200">{count} transactions</strong></span>
                    <span>Avg: <strong className="text-slate-200">{formatCurrency(cat.amount?.average || 0)}</strong></span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Regularity / Stability:</span>
                    <span className="text-sky-400 font-medium">{stability}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${stability}%` }}
                    />
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
