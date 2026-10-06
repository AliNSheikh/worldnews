import React from 'react';
import { X, ShieldCheck, Feather, Sparkles, ExternalLink, HelpCircle, FileText } from 'lucide-react';
import { LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface EditorialCharterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: LanguageCode;
}

export const EditorialCharterModal: React.FC<EditorialCharterModalProps> = ({
  isOpen,
  onClose,
  currentLang,
}) => {
  if (!isOpen) return null;
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {t.editorialGuidelines}
              </h2>
              <p className="text-xs text-slate-400">
                News Discover Code of Ethics, Verification Standards & AI Disclosure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm leading-relaxed">
          {/* Section 1: Editorial Classifications */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              1. Editorial Classification System
            </h3>
            <p className="mb-3 text-slate-600">
              News Discover rigorously categorizes every published piece to ensure complete transparency with readers:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs mb-1">
                  <Feather className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ORIGINAL REPORTING</span>
                </div>
                <p className="text-xs text-emerald-950">
                  Authored directly by News Discover staff journalists or credentialed contributors. All factual claims are verified through direct interviews, primary documents, or first-hand field reporting.
                </p>
              </div>

              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg">
                <div className="flex items-center gap-2 font-bold text-sky-900 text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-sky-700" />
                  <span>AI-ASSISTED EDITORIAL</span>
                </div>
                <p className="text-xs text-sky-950">
                  Produced with machine editorial assistance (Gemini 3.8-Flash) utilizing verified wire inputs. Used for multilingual translation, executive summarization, and structured context. All output is governed by strict schema constraints and human editorial review.
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                  <span>EXTERNAL WIRE ATTRIBUTION</span>
                </div>
                <p className="text-xs text-amber-950">
                  Syndicated or ingested directly from recognized international news agencies (e.g. Reuters, Associated Press, Deutsche Welle, BBC) under approved editorial agreements, with full canonical and backlink attribution.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Verification & Fact-Checking Disclosure */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-600" />
              2. Sourcing & Verification Standard
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm">
              News Discover does <strong>NOT</strong> make claims of autonomous machine fact-checking. Artificial intelligence models do not replace journalistic investigation. We mandate that factual assertions cite at least two independent primary sources or authorized wire communiqués before publication.
            </p>
          </div>

          {/* Section 3: Corrections & Retractions Policy */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              3. Corrections & Retractions Policy
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm">
              If an error of fact is identified, our newsroom will append a timestamped correction notice at the top of the article detailing the date, nature of the revision, and previous text. In cases of unverified claims, reports will be archived immediately pending editorial review.
            </p>
          </div>

          {/* Section 4: Multilingual Parity */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              4. Multilingual Parity & Cultural Accuracy
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm">
              We uphold editorial quality across all five supported languages (Arabic, English, German, Spanish, French). Translations must preserve the cultural nuances, formal journalistic conventions, and correct geographic designations of each target region.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
