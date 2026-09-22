import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, Filter } from 'lucide-react';

interface FraudTabProps {
  data: any;
}

export const FraudTab: React.FC<FraudTabProps> = ({ data }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'passed'>('all');

  const fraudGroups = data?.analysis?.analytics?.consumer?.fraudIndicators || [];
  const rules = fraudGroups[0]?.rules || [];

  const filteredRules = rules.filter((rule: any) => {
    const matchesCat =
      filterCategory === 'all' || rule.fraudCategory?.toLowerCase() === filterCategory.toLowerCase();
    const isIdentified = rule.identified?.toLowerCase() === 'yes';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'flagged' && isIdentified) ||
      (statusFilter === 'passed' && !isIdentified);
    return matchesCat && matchesStatus;
  });

  const flaggedCount = rules.filter((r: any) => r.identified?.toLowerCase() === 'yes').length;
  const passedCount = rules.length - flaggedCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Fraud & Anomaly Detection Rules</h2>
          <p className="text-xs text-slate-400">
            34 automated forensic banking checks covering behavioral, transactional, and accounting patterns
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{passedCount} Passed</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{flaggedCount} Flagged</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Category:</span>
          {['all', 'transactional', 'behavioural', 'accounting'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize transition ${
                filterCategory === cat
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({rules.length})
          </button>
          <button
            onClick={() => setStatusFilter('flagged')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'flagged'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => setStatusFilter('passed')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'passed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Passed ({passedCount})
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      {filteredRules.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No matching fraud rules for selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule: any, idx: number) => {
            const isFlagged = rule.identified?.toLowerCase() === 'yes';

            return (
              <div
                key={idx}
                className={`glass-panel p-5 glass-card-interactive border-l-4 ${
                  isFlagged ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-emerald-500/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400">{rule.fraudId}</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {rule.fraudCategory}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isFlagged ? 'gradient-badge-amber' : 'gradient-badge-green'
                    }`}
                  >
                    {isFlagged ? 'Flagged / Attention' : 'Passed / Clear'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mb-1">{rule.fraudType}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{rule.fraudDesc}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
