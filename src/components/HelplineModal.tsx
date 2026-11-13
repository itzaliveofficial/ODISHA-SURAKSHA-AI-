/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OFFICIAL_ODISHA_HELPLINES } from '../data/sampleIncidents';
import { Phone, Copy, Check, AlertTriangle, X } from 'lucide-react';

interface HelplineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelplineModal: React.FC<HelplineModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string>('');

  if (!isOpen) return null;

  const handleCopy = async (number: string, index: number) => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(number);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setCopyError(`Clipboard access unavailable. Please dial or copy manually: ${number}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="helpline-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#0D1527] border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h2 id="helpline-modal-title" className="text-base font-bold text-white">
                Odisha Public Emergency Helplines Reference
              </h2>
              <span className="text-xs text-slate-400">
                Public crisis directory — verify locally before relying on third-party numbers
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close helpline directory"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real Helpline Advisory Notice */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
          <div className="font-semibold text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Emergency Dispatch Protocol (Dial 112 / 1070)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            This web application is NOT connected to official government emergency dispatch systems. In an actual
            life-threatening emergency in Odisha, immediately dial <strong>112</strong> (ERSS) or{' '}
            <strong>1070</strong> (SEOC).
          </p>
        </div>

        {copyError && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            {copyError}
          </div>
        )}

        {/* Directory List */}
        <div className="space-y-2.5">
          {OFFICIAL_ODISHA_HELPLINES.map((helpline, index) => (
            <div
              key={index}
              className="p-3 bg-[#121B30] border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{helpline.agency}</span>
                  {helpline.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                      {helpline.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">{helpline.description}</div>
                <div className="text-[10px] text-slate-400">Coverage: {helpline.coverage}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold text-sm text-teal-300 px-2 py-1 bg-slate-900 rounded border border-slate-800">
                  {helpline.number}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(helpline.number, index)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Copy helpline number"
                  aria-label={`Copy ${helpline.agency} number`}
                >
                  {copiedIndex === index ? (
                    <Check className="w-3.5 h-3.5 text-teal-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
};
