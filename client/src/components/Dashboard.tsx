import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Tags,
  AlertTriangle,
  ShieldAlert,
  Repeat,
  Receipt,
  UserCheck,
  UploadCloud,
  FileText,
  Calendar,
  Download,
} from 'lucide-react';
import { DashboardTab } from '../types/client';
import { OverviewTab } from './tabs/OverviewTab';
import { AccountsTab } from './tabs/AccountsTab';
import { CashFlowTab } from './tabs/CashFlowTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { RiskTab } from './tabs/RiskTab';
import { FraudTab } from './tabs/FraudTab';
import { RecurringTab } from './tabs/RecurringTab';
import { TransactionsTab } from './tabs/TransactionsTab';
import { ProfileTab } from './tabs/ProfileTab';

interface DashboardProps {
  data: any;
  onOpenUploadModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onOpenUploadModal }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const navTabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'accounts', label: 'Accounts', icon: <Building2 className="w-4 h-4" /> },
    { id: 'cashflow', label: 'Cash Flow & Trends', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'categories', label: 'Categories', icon: <Tags className="w-4 h-4" /> },
    { id: 'risk', label: 'Risk Profile', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'fraud', label: 'Fraud Detection (34)', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'recurring', label: 'Salary & Recurring', icon: <Repeat className="w-4 h-4" /> },
    { id: 'transactions', label: 'Transactions', icon: <Receipt className="w-4 h-4" /> },
    { id: 'profile', label: 'KYC Profile', icon: <UserCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {data?.analysis?.document?.bankName || 'Bank'} Statement Analysis
            </h1>
            <p className="text-xs text-slate-400">
              {data?.analysis?.document?.accountHolderName && (
                <>
                  Account Holder:{' '}
                  <span className="text-slate-200 font-medium">
                    {data.analysis.document.accountHolderName}
                  </span>{' '}
                  •{' '}
                </>
              )}
              Period:{' '}
              <span className="text-slate-200">
                {data?.analysis?.document?.statementStartDate && data?.analysis?.document?.statementEndDate
                  ? `${data.analysis.document.statementStartDate} to ${data.analysis.document.statementEndDate}`
                  : data?.analysis?.document?.statementStartDate || 'Extracted Statement Period'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
          >
            <UploadCloud className="w-4 h-4" /> Upload Another Statement
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto pb-1 gap-2 border-b border-slate-800/80">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab View */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'accounts' && <AccountsTab data={data} />}
        {activeTab === 'cashflow' && <CashFlowTab data={data} />}
        {activeTab === 'categories' && <CategoriesTab data={data} />}
        {activeTab === 'risk' && <RiskTab data={data} />}
        {activeTab === 'fraud' && <FraudTab data={data} />}
        {activeTab === 'recurring' && <RecurringTab data={data} />}
        {activeTab === 'transactions' && <TransactionsTab data={data} />}
        {activeTab === 'profile' && <ProfileTab data={data} />}
      </div>
    </div>
  );
};
