import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ZamuLogoIcon } from '../common/CustomSvgIcons';
import {
  SlidersHorizontal,
  Moon,
  Sun,
  LogOut,
  Users,
  Repeat,
  CheckSquare,
  BarChart3,
  Archive,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

interface HeaderProps {
  onOpenPersonalization: () => void;
  onOpenSignoff: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPersonalization,
  onOpenSignoff,
  onOpenAuthModal,
}) => {
  const {
    activeTab,
    setActiveTab,
    activeHandover,
    themeConfig,
    setThemeConfig,
    currentUser,
    hasAdminClearance,
    signOutUser,
  } = useHandover();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSigned =
    activeHandover.signoff.outgoingConfirmed && activeHandover.signoff.incomingConfirmed;

  const navItems = [
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'active-handover', label: 'Handover', icon: Repeat },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'archive', label: 'Archive', icon: Archive },
  ] as const;

  const handleNavClick = (tabId: typeof navItems[number]['id']) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Brand */}
          <button
            onClick={() => handleNavClick('roster')}
            className="flex items-center gap-2.5 text-left focus:outline-none group cursor-pointer shrink-0"
          >
            <div className="text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
              <ZamuLogoIcon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap block leading-none">
                ZAMU-CHECK
              </span>
              <span className="text-[9px] tracking-wider text-slate-400 dark:text-slate-500 font-mono uppercase block pt-0.5">
                KQ Cargo
              </span>
            </div>
          </button>

          {/* Desktop Navigation with Icons */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Authenticated User */}
            <button
              onClick={onOpenAuthModal}
              title="Switch user or view profile"
              className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
            >
              <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                {currentUser.avatarSeed}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-semibold text-slate-900 dark:text-white block leading-none truncate max-w-[100px]">
                  {currentUser.name}
                </span>
                <span className="text-[9px] text-slate-400 block pt-0.5 truncate max-w-[100px]">
                  {hasAdminClearance && currentUser.isAdmin ? 'Supervisor' : currentUser.role}
                </span>
              </div>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setThemeConfig((prev) => ({ ...prev, isDark: !prev.isDark }))}
              title={themeConfig.isDark ? 'Day mode' : 'Night mode'}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {themeConfig.isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Theme Customizer */}
            <button
              onClick={onOpenPersonalization}
              title="Customization"
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer hidden sm:inline-flex"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Sign Out */}
            <button
              onClick={signOutUser}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Primary Action Button */}
            <button
              onClick={onOpenSignoff}
              className={`hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer ${
                isSigned
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isSigned ? 'Sealed' : 'Sign Off'}</span>
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 md:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1 animate-in fade-in duration-150">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => { onOpenSignoff(); setMobileMenuOpen(false); }}
              className="col-span-2 mt-2 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg bg-teal-700 text-white cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSigned ? 'View Sign-Off Seal' : 'Sign Handover'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
