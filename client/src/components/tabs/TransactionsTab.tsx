import React, { useState } from 'react';
import { Search, Filter, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface TransactionsTabProps {
  data: any;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ data }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const rawTxns =
    data?.analysis?.analytics?.categorizedTransactions ||
    data?.analysis?.transactions ||
    [];

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Math.abs(val));
  };

  const filtered = rawTxns.filter((t: any) => {
    const desc = (t.description || t.debtorName || t.creditorName || '').toLowerCase();
    const matchesSearch = !search || desc.includes(search.toLowerCase());

    const isCredit = t.amount > 0 || t.type === 'CREDIT';
    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'CREDIT' && isCredit) ||
      (typeFilter === 'DEBIT' && !isCredit);

    const mode = (t.additionalInformation || t.mode || '').toUpperCase();
    const matchesMode =
      modeFilter === 'ALL' ||
      (modeFilter === 'UPI' && mode.includes('UPI')) ||
      (modeFilter === 'IMPS' && mode.includes('IMPS')) ||
      (modeFilter === 'NEFT' && mode.includes('NEFT')) ||
      (modeFilter === 'ATM' && mode.includes('ATM'));

    return matchesSearch && matchesType && matchesMode;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Categorized Transactions Explorer</h2>
          <p className="text-xs text-slate-400">
            Search, filter, and inspect detailed ledger entries and party metadata
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          Showing {filtered.length} of {rawTxns.length} transactions
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="glass-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search party, description, UPI..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex rounded-lg bg-slate-900/90 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setTypeFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-md transition ${
                typeFilter === 'ALL' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setTypeFilter('CREDIT');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-md transition ${
                typeFilter === 'CREDIT' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400'
              }`}
            >
              Credits
            </button>
            <button
              onClick={() => {
                setTypeFilter('DEBIT');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-md transition ${
                typeFilter === 'DEBIT' ? 'bg-rose-500/20 text-rose-300 font-medium' : 'text-slate-400'
              }`}
            >
              Debits
            </button>
          </div>

          {/* Mode Filter */}
          <div className="flex rounded-lg bg-slate-900/90 p-1 border border-slate-800 text-xs">
            {['ALL', 'UPI', 'IMPS', 'NEFT', 'ATM'].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setModeFilter(mode);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md transition ${
                  modeFilter === mode ? 'bg-sky-500/20 text-sky-300 font-medium' : 'text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No transactions found matching the selected filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Narration / Counterparty</th>
                    <th className="p-3.5">Payment Mode</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {paginated.map((t: any, idx: number) => {
                    const isCredit = t.amount > 0 || t.type === 'CREDIT';
                    const date = t.bookingDate || t.date || '—';
                    const mode = (t.additionalInformation?.replace('IND_CE|', '') || t.mode || 'OTHER').replace('|', '');
                    const bal = t.balance?.closingBalanceAmount ?? t.balance;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition font-sans">
                        <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">{date}</td>
                        <td className="p-3.5">
                          <div className="text-slate-200 font-medium max-w-md truncate">
                            {t.description || 'Transaction'}
                          </div>
                          {(t.debtorName || t.creditorName) && (
                            <div className="text-[11px] text-slate-400 uppercase font-mono">
                              Party: {t.debtorName || t.creditorName}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="bg-slate-800 text-sky-300 font-mono px-2 py-0.5 rounded text-[10px]">
                            {mode}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {t.categoryName || t.category || 'General'}
                          </span>
                        </td>
                        <td
                          className={`p-3.5 text-right font-mono font-bold whitespace-nowrap ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-300 whitespace-nowrap">
                          {bal !== undefined && bal !== null ? formatCurrency(bal) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Page <span className="text-white font-semibold">{currentPage}</span> of{' '}
                <span className="text-white font-semibold">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
