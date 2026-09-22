import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  FileCheck,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Lock,
  Layers,
  ArrowRight,
  Database,
  Search,
} from 'lucide-react';
import { UploadModal } from './components/UploadModal';
import { Dashboard } from './components/Dashboard';

export const App: React.FC = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setAnalysisData(null)}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  BankStatement<span className="text-sky-400">AI</span>
                </span>
                <span className="text-[10px] font-semibold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                  Production Validator
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Multi-Signal Classification & Forensic Statement Analyzer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {analysisData && (
              <button
                onClick={() => setAnalysisData(null)}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
              >
                Clear View
              </button>
            )}

            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{analysisData ? 'Upload New Statement' : 'Upload Statement PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {analysisData ? (
          <Dashboard
            data={analysisData}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
        ) : (
          /* Empty / Landing Hero */
          <div className="py-16 text-center max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-sky-400" />
              Automated Bank PDF Validation & Multi-Signal Classifier
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Enterprise Bank Statement <br />
              <span className="gradient-text">Validation & Financial Analyzer</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
              Upload genuine bank statement PDFs from Indian and global banks. Rejects Aadhaar,
              PAN, Salary Slips, Invoices, Loan Agreements, and fake PDFs with strict magic-byte
              verification and multi-signal scoring.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition"
              >
                <UploadCloud className="w-5 h-5" />
                Upload Bank Statement PDF
              </button>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left">
              <div className="glass-panel p-5">
                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 w-fit mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1">
                  Strict File & Magic-Byte Guard
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verifies %PDF- signatures, detects encrypted PDFs, corrupted files, and rejects
                  MIME spoofing.
                </p>
              </div>

              <div className="glass-panel p-5">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1">Multi-Signal Classification</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Weighted scoring for Indian bank identities, IFSC, ledger tables, rejecting
                  Aadhaar, PAN, and invoices.
                </p>
              </div>

              <div className="glass-panel p-5">
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 w-fit mb-3">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1">34 Forensic Risk Checks</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Identifies round-figure debits, high UPI transfers, salary regularity, and loan
                  servicing capacity.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Bank Statement Validation Pipeline • Secure In-Memory Buffer Processing</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Encrypted PDFs Detected</span>
            <span>•</span>
            <span>Non-Bank Documents Rejected</span>
            <span>•</span>
            <span>Zero PII Data Leaks</span>
          </div>
        </div>
      </footer>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onAnalysisComplete={(data) => setAnalysisData(data)}
      />
    </div>
  );
};
