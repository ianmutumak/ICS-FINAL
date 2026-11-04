import React from 'react';
import { useHandover } from '../../context/HandoverContext';
import { X, Check, Palette, Type, Layers, Sparkles } from 'lucide-react';
import {
  ZamuLogoIcon,
  SbarProtocolIcon,
  DualSignoffStampIcon,
  ErdBranchIcon,
  CustodyShieldIcon,
} from '../common/CustomSvgIcons';
import { SectorType } from '../../types';

interface PersonalizationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonalizationDrawer: React.FC<PersonalizationDrawerProps> = ({ isOpen, onClose }) => {
  const { themeConfig, setThemeConfig } = useHandover();

  if (!isOpen) return null;

  const fontOptions: { id: typeof themeConfig.fontDisplay; label: string; desc: string }[] = [
    { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', desc: 'Crisp Neo-Grotesque, highly legibile at small sizes' },
    { id: 'Outfit', label: 'Outfit', desc: 'Geometric, modern technological clarity' },
    { id: 'Manrope', label: 'Manrope', desc: 'Semi-condensed, warm architectural proportions' },
    { id: 'Syne', label: 'Syne', desc: 'Distinctive avant-garde editorial character' },
  ];

  const colorThemes: { id: typeof themeConfig.colorTheme; label: string; accentClass: string; desc: string }[] = [
    {
      id: 'clinical-teal',
      label: 'Aero Jade & Slate',
      accentClass: 'bg-teal-600',
      desc: 'Air cargo dispatch, customs inspection, and bonded warehouse terminal palette',
    },
    {
      id: 'circadian-night',
      label: 'Circadian Amber & Night',
      accentClass: 'bg-amber-500',
      desc: '03:00 Graveyard shift low-blue-light circadian preservation mode',
    },
    {
      id: 'industrial-slate',
      label: 'Industrial Steel & Cobalt',
      accentClass: 'bg-indigo-600',
      desc: 'Heavy ramp machinery, airside high-loaders, and 24/7 continuous operations',
    },
    {
      id: 'emergency-coral',
      label: 'HAZMAT & Safety Alert',
      accentClass: 'bg-rose-600',
      desc: 'Dangerous Goods containment, urgent ramp safety holds, and LOTO lockouts',
    },
  ];

  const sectors: { id: SectorType; label: string; sub: string }[] = [
    { id: 'kq_bonded_freight', label: 'Kenya Airways Cargo & Bonded Freight', sub: 'Import/Export Bonded Terminals, ULD Dollies, KRA Customs, SBAR Rigor' },
    { id: 'warehouse_logistics', label: 'General Warehouse & Distribution', sub: 'High-Bay Automated Racking, MHE Reach Trucks, Cross-Dock Dataloggers' },
    { id: 'industrial_onsite', label: 'Industrial On-Site & Plant Operations', sub: 'Manufacturing Plants, Heavy Machinery Telemetry, LOTO Safety Controls' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Interface & Theme Studio
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Custom typography, circadian accents & SVG styling
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Typography */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Type className="w-3.5 h-3.5" />
                <span>Typography Engine</span>
              </div>
              <div className="space-y-2">
                {fontOptions.map((font) => {
                  const isSelected = themeConfig.fontDisplay === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setThemeConfig((prev) => ({ ...prev, fontDisplay: font.id }))}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <div
                          className="text-sm font-semibold text-slate-900 dark:text-white"
                          style={{ fontFamily: font.id }}
                        >
                          {font.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {font.desc}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Circadian & Accent Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Palette className="w-3.5 h-3.5" />
                <span>Duty Palette & Circadian Lighting</span>
              </div>
              <div className="space-y-2">
                {colorThemes.map((cTheme) => {
                  const isSelected = themeConfig.colorTheme === cTheme.id;
                  return (
                    <button
                      key={cTheme.id}
                      type="button"
                      onClick={() => setThemeConfig((prev) => ({ ...prev, colorTheme: cTheme.id }))}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${cTheme.accentClass} shrink-0`} />
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {cTheme.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {cTheme.desc}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Operational Sector Preset */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Layers className="w-3.5 h-3.5" />
                <span>Operational Sector Preset</span>
              </div>
              <div className="space-y-2">
                {sectors.map((sec) => {
                  const isSelected = themeConfig.sector === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setThemeConfig((prev) => ({ ...prev, sector: sec.id }))}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {sec.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {sec.sub}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operational Governance Framework */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <CustodyShieldIcon className="w-3.5 h-3.5 text-teal-500" />
                <span>Operational Governance Framework</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                ZAMU-CHECK enforces verified continuous-process standards across every shift turnover:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40">
                  <SbarProtocolIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">SBAR Protocol</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40">
                  <DualSignoffStampIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">Dual Sign-Off</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40">
                  <CustodyShieldIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">Custody Ledger</span>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
