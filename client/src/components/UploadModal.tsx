import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  FileQuestion,
  Loader2,
  RefreshCw,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { UploadState, ClientError, ERROR_MESSAGES_MAP } from '../types/client';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (data: any) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onAnalysisComplete,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('IDLE');
  const [error, setError] = useState<ClientError | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedFile(null);
    setUploadState('IDLE');
    setError(null);
    setProgressText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateFileClientSide = (file: File): string | null => {
    // 1. Empty file
    if (file.size === 0) {
      return ERROR_MESSAGES_MAP.EMPTY_FILE;
    }

    // 2. Extension check
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf')) {
      return ERROR_MESSAGES_MAP.INVALID_FILE_TYPE;
    }

    // 3. MIME type check
    if (file.type && file.type !== 'application/pdf') {
      return ERROR_MESSAGES_MAP.INVALID_FILE_TYPE;
    }

    // 4. Max Size Check (15MB)
    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return ERROR_MESSAGES_MAP.FILE_TOO_LARGE;
    }

    return null;
  };

  const handleFileSelection = (file: File) => {
    setError(null);
    const validationError = validateFileClientSide(file);
    if (validationError) {
      setUploadState('ERROR');
      setError({
        code: 'INVALID_FILE_TYPE',
        message: validationError,
      });
      return;
    }

    setSelectedFile(file);
    setUploadState('SELECTED');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState === 'IDLE' || uploadState === 'SELECTED') {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (uploadState !== 'IDLE' && uploadState !== 'SELECTED' && uploadState !== 'ERROR') {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        setError({
          code: 'MULTIPLE_FILES',
          message: 'Please upload only one bank statement PDF at a time.',
        });
        setUploadState('ERROR');
        return;
      }
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const executeUploadAndAnalysis = async () => {
    if (!selectedFile) return;

    // Prevent double submission
    if (
      uploadState === 'UPLOADING' ||
      uploadState === 'READING_PDF' ||
      uploadState === 'VERIFYING_DOCUMENT' ||
      uploadState === 'ANALYZING'
    ) {
      return;
    }

    setError(null);
    setUploadState('UPLOADING');
    setProgressText('Uploading file securely to server...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Stepped progression for rich UX feedback
      const timer1 = setTimeout(() => {
        setUploadState('READING_PDF');
        setProgressText('Detecting PDF type & extracting statement content...');
      }, 500);

      const timer2 = setTimeout(() => {
        setProgressText('Running OCR on scanned / image pages if required...');
      }, 1200);

      const timer3 = setTimeout(() => {
        setUploadState('VERIFYING_DOCUMENT');
        setProgressText('Detecting bank, account details & statement period...');
      }, 2000);

      const timer4 = setTimeout(() => {
        setUploadState('ANALYZING');
        setProgressText('Extracting transactions & validating financial balances...');
      }, 2900);

      const response = await fetch('/api/statement/analyze', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadState('SUCCESS');
        setProgressText('Bank Statement Verified & Analyzed Successfully!');
        setTimeout(() => {
          onAnalysisComplete(data.data);
          onClose();
          resetState();
        }, 800);
      } else {
        const errCode = data.error?.code || 'INTERNAL_ERROR';
        const customMessage = data.error?.message || ERROR_MESSAGES_MAP[errCode] || ERROR_MESSAGES_MAP.INTERNAL_ERROR;
        
        setUploadState('ERROR');
        setError({
          code: errCode,
          message: customMessage,
          requestId: data.requestId,
        });
      }
    } catch (err: any) {
      setUploadState('ERROR');
      setError({
        code: 'NETWORK_ERROR',
        message: 'Could not connect to the analysis server. Please ensure backend is running.',
      });
    }
  };

  const getErrorIcon = (code?: string) => {
    switch (code) {
      case 'ENCRYPTED_PDF':
        return <Lock className="w-10 h-10 text-amber-400" />;
      case 'NOT_BANK_STATEMENT':
      case 'UNCERTAIN_DOCUMENT':
        return <FileQuestion className="w-10 h-10 text-rose-400" />;
      default:
        return <AlertCircle className="w-10 h-10 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        className="w-full max-w-xl glass-panel p-6 sm:p-8 relative animate-in fade-in zoom-in duration-200"
        style={{
          background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(12, 17, 29, 0.98) 100%)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={uploadState === 'UPLOADING' || uploadState === 'ANALYZING'}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Bank Statement</h2>
              <p className="text-xs text-slate-400">
                PDF format only • Indian & International Bank Statements supported
              </p>
            </div>
          </div>
        </div>

        {/* Upload Zone / State View */}
        {uploadState === 'ERROR' && error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center mb-6">
            <div className="flex justify-center mb-3">{getErrorIcon(error.code)}</div>
            <h3 className="text-lg font-semibold text-rose-200 mb-2">
              {error.code === 'NOT_BANK_STATEMENT'
                ? 'Invalid Document Type'
                : error.code === 'ENCRYPTED_PDF'
                ? 'Password Protected PDF'
                : 'Upload Validation Failed'}
            </h3>
            <p className="text-sm text-rose-300/90 leading-relaxed max-w-md mx-auto mb-4">
              {error.message}
            </p>
            {error.requestId && (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-900/60 py-1.5 px-3 rounded-lg inline-block border border-slate-800 mb-4">
                Ref ID: {error.requestId}
              </div>
            )}
            <div>
              <button
                onClick={resetState}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium shadow-lg transition"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          </div>
        ) : uploadState === 'IDLE' || uploadState === 'SELECTED' ? (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                  : selectedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700/80 hover:border-sky-500/50 hover:bg-slate-800/40 bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-3 border border-emerald-500/30">
                    <FileText className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-white text-base truncate max-w-sm mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
                  </p>
                  <span className="mt-3 text-xs text-sky-400 hover:underline">
                    Click to change file
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-4 rounded-2xl bg-sky-500/10 text-sky-400 mb-3 border border-sky-500/20">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-white text-base mb-1">
                    Drag & Drop your Bank Statement PDF here
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mb-3">
                    or click to browse from your device (Max 15MB)
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Strict Magic-Byte & Multi-Signal Document Validation</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rejection Warning Notices */}
            <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-300">Notice:</span> Aadhaar, PAN cards,
                salary slips, tax invoices, and loan agreements will be automatically rejected.
                Please ensure you upload an official bank account statement.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile}
                onClick={executeUploadAndAnalysis}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${
                  selectedFile
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/25'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4" />
                Validate & Analyze Statement
              </button>
            </div>
          </div>
        ) : (
          /* Processing State */
          <div className="py-12 px-6 text-center">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-sky-400">
                <FileText className="w-7 h-7 animate-pulse" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Processing Document</h3>
            <p className="text-sm text-sky-300/80 max-w-sm mx-auto mb-6">{progressText}</p>

            {/* Animated Progress Track */}
            <div className="w-full max-w-md mx-auto h-2 bg-slate-800 rounded-full progress-bar-animated mb-4"></div>

            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <span
                className={
                  uploadState === 'UPLOADING'
                    ? 'text-sky-400 font-medium'
                    : 'text-slate-500'
                }
              >
                1. Upload
              </span>
              <span>•</span>
              <span
                className={
                  uploadState === 'READING_PDF'
                    ? 'text-sky-400 font-medium'
                    : 'text-slate-500'
                }
              >
                2. PDF Verification
              </span>
              <span>•</span>
              <span
                className={
                  uploadState === 'VERIFYING_DOCUMENT'
                    ? 'text-sky-400 font-medium'
                    : 'text-slate-500'
                }
              >
                3. Classifier
              </span>
              <span>•</span>
              <span
                className={
                  uploadState === 'ANALYZING'
                    ? 'text-sky-400 font-medium'
                    : 'text-slate-500'
                }
              >
                4. Analytics
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
