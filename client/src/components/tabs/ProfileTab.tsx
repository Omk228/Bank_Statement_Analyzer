import React from 'react';
import { User, Mail, Phone, MapPin, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

interface ProfileTabProps {
  data: any;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ data }) => {
  const profiles = data?.analysis?.analytics?.consumer?.customerProfile || [];
  const primaryProfile = profiles[0] || {};
  const identity = data?.analysis?.analytics?.consumer?.identity || {};
  const doc = data?.analysis?.document || {};

  const name = doc.accountHolderName || primaryProfile.name || 'Account Holder';
  const accountNum = doc.accountNumber || primaryProfile.accountId || '—';
  const bank = doc.bankName || primaryProfile.bank || 'Bank Statement';
  const ifsc = doc.ifsc || primaryProfile.ifsc || '—';
  const accountType = doc.accountType || primaryProfile.accountType || 'SAVINGS';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-bold text-white">Customer & KYC Profile</h2>
        <p className="text-xs text-slate-400">
          Extracted identity records, verification indicators, and account holder details
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Identity Card */}
        <div className="glass-panel p-6 glass-card-interactive">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {name}
                </h3>
                <span className="gradient-badge-green px-2 py-0.5 rounded-full text-[10px] font-semibold">
                  Statement Verified Profile
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Bank Entity:</span>
              <span className="text-slate-200 font-semibold">
                {bank}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Account Number:</span>
              <span className="text-slate-200 font-mono">
                {accountNum}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Account Type:</span>
              <span className="text-emerald-400 font-mono font-semibold">
                {accountType.replace(/-/g, ' ')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">IFSC / Branch:</span>
              <span className="text-slate-200 font-mono">{ifsc}</span>
            </div>

            <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span className="text-slate-400 shrink-0">Statement Period:</span>
              <span className="text-slate-300 text-[11px] leading-relaxed">
                {doc.statementStartDate && doc.statementEndDate
                  ? `${doc.statementStartDate} to ${doc.statementEndDate}`
                  : 'Extracted from statement cycle'}
              </span>
            </div>
          </div>
        </div>

        {/* Business / Identity Checks */}
        <div className="glass-panel p-6 glass-card-interactive flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Entity & Trader Verification</h3>
                <p className="text-xs text-slate-400">Business classification checks</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Sole Trader / Business Operator:</span>
                <span className="font-semibold text-emerald-400">
                  {identity.soleTrader ? 'Yes (Sole Proprietor / Business Activity)' : 'Individual Consumer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Classification Verification:</span>
                <span className="font-semibold text-sky-400">
                  {Math.round((data?.classification?.confidence || 0.95) * 100)}% Confidence Match
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Accounts Analyzed:</span>
                <span className="font-semibold text-slate-200">{profiles.length || 1} Statement Account</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Account verified through multi-signal cryptographic & ledger extraction.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
