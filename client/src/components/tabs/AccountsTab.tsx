import React from 'react';
import { Building2, CreditCard, Activity, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface AccountsTabProps {
  data: any;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({ data }) => {
  const connections =
    data?.analysis?.analytics?.consumer?.base?.subject?.connections || [];
  const profiles = data?.analysis?.analytics?.consumer?.customerProfile || [];
  const doc = data?.analysis?.document || {};

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Connected Accounts</h2>
          <p className="text-xs text-slate-400">
            Identified bank accounts, balances, and significance distribution
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          Total Accounts: {connections.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connections.map((conn: any, idx: number) => {
          const kpi = conn.kpi || {};
          const account = conn.accounts?.[0] || {};
          const profile = profiles.find((p: any) => p.bank?.toLowerCase().includes(conn.connectionId?.toLowerCase())) || profiles[idx] || {};

          return (
            <div
              key={idx}
              className="glass-panel p-6 glass-card-interactive flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {conn.connectionId || doc.bankName || 'Bank Account'}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">
                        {account.accountId || profile.accountId || doc.accountNumber || '—'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      idx === 0 || kpi.significantAccountsCount > 0 || account.kpi?.significanceIndex > 0
                        ? 'gradient-badge-green'
                        : 'gradient-badge-blue'
                    }`}
                  >
                    {idx === 0 ? 'Primary' : 'Secondary'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Total Balance:</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {formatCurrency(account.kpi?.balance?.totalBalanceAmount ?? kpi.balance?.totalBalanceAmount ?? data?.analysis?.summary?.closingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Average Balance:</span>
                    <span className="text-slate-200 font-mono">
                      {formatCurrency(account.kpi?.balance?.averageBalanceAmount ?? kpi.balance?.averageBalanceAmount ?? data?.analysis?.summary?.closingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Max Balance:</span>
                    <span className="text-slate-200 font-mono">
                      {formatCurrency(account.kpi?.balance?.maxBalanceAmount ?? kpi.balance?.maxBalanceAmount ?? data?.analysis?.summary?.closingBalance)}
                    </span>
                  </div>
                </div>

                {/* Account Details & KYC */}
                <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                  <div className="flex justify-between">
                    <span>Account Type:</span>
                    <span className="text-slate-200 font-medium">
                      {(profile.accountType || doc.accountType || 'SAVINGS').replace(/-/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>IFSC Code:</span>
                    <span className="text-slate-200 font-mono">{profile.ifsc || doc.ifsc || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Statement Period:</span>
                    <span className="text-slate-200">{profile.accountOpeningDate || doc.statementStartDate || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Transactions Activity Summary */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{account.kpi?.periodTransactionsCount?.income ?? kpi.periodTransactionsCount?.income ?? 0} Credits</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{account.kpi?.periodTransactionsCount?.expenses ?? kpi.periodTransactionsCount?.expenses ?? 0} Debits</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
