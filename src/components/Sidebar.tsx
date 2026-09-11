import React from 'react';
import { useApp } from '../context/AppContext';
import {
  UserPlus,
  TableProperties,
  Award,
  Layers,
  Users,
  Receipt,
  Settings,
  Lock,
  FileCheck2,
  BookOpenCheck,
  ChevronsLeft,
  ChevronsRight,
  X,
  Sparkles,
  Search,
} from 'lucide-react';

export type TabType =
  | 'INTAKE_DESK'
  | 'SUBMISSIONS_TRACKER'
  | 'INTAKE_REGISTER'
  | 'EVALUATION_MASTER'
  | 'SED_AWARD_SHEETS'
  | 'MARKS_ENTRY'
  | 'COURSE_LEDGER'
  | 'EVALUATORS'
  | 'REMUNERATION'
  | 'SETTINGS';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const {
    isAdmin,
    isUrlLockedDeskMode,
    userRole,
    openSearchModal,
    sessionIntakes,
    sessionAssignmentSubmissions,
    sessionCourseEvaluations,
    sessionPackets,
    sessionBills,
    evaluators,
    settings,
    isSidebarHidden,
    setIsSidebarHidden,
    toggleSidebarHidden,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
    syncGoogleSheets,
    isSyncingSheets,
    syncStatus,
  } = useApp();

  // Guard against navigating to unauthorized tabs in Desk Official mode
  React.useEffect(() => {
    if (
      (userRole === 'desk' || isUrlLockedDeskMode) &&
      activeTab !== 'INTAKE_DESK' &&
      activeTab !== 'EVALUATION_MASTER'
    ) {
      setActiveTab('INTAKE_DESK');
    }
  }, [userRole, isUrlLockedDeskMode, activeTab, setActiveTab]);

  // Dynamic calculations for stage counters
  const intakeCount = sessionIntakes.length;
  const evalCount = sessionCourseEvaluations.length;
  const lockedEvalCount = sessionCourseEvaluations.filter((e) => e.isLocked).length;
  const gradedEvalCount = sessionCourseEvaluations.filter((e) => e.marks !== null).length;
  const subCount = sessionAssignmentSubmissions.length;
  const packetCount = sessionPackets.length;
  const evalDirectoryCount = evaluators.length;

  const navSections = [
    {
      title: 'Statutory Stages',
      items: [
        {
          id: 'INTAKE_DESK' as TabType,
          stageTag: 'Stage 1',
          label: 'Intake & Desk',
          fullTitle: 'Stage 1: Student Intake & Desk',
          icon: UserPlus,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: intakeCount > 0 ? `${intakeCount}` : 'Active',
          badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200',
        },
        {
          id: 'EVALUATION_MASTER' as TabType,
          stageTag: 'Stage 2',
          label: 'Course Evaluation Master',
          fullTitle: 'Stage 2: 2_Course_Evaluation_Master',
          icon: BookOpenCheck,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: evalCount > 0 ? `${evalCount}` : null,
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
        },
        {
          id: 'SED_AWARD_SHEETS' as TabType,
          stageTag: 'Stage 3',
          label: 'SED Award Sheets (3-Part)',
          fullTitle: 'Stage 3: Regional Centre SED Award Sheets',
          icon: Award,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: lockedEvalCount > 0 ? `${lockedEvalCount} Locked` : '3-Part',
          badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        },
        {
          id: 'REMUNERATION' as TabType,
          stageTag: 'Stage 4',
          label: 'Evaluator Remuneration',
          fullTitle: 'Stage 4: Evaluator Remuneration & Claim Billing',
          icon: Receipt,
          roles: ['ADMIN'],
          adminOnly: true,
          badge: `₹${settings.remunerationRatePerScript.toFixed(2)}`,
          badgeColor: 'bg-purple-100 text-purple-900 border-purple-200',
        },
      ],
    },
    {
      title: 'Registers & Tracking',
      items: [
        {
          id: 'SUBMISSIONS_TRACKER' as TabType,
          stageTag: null,
          label: 'Submissions Tracker',
          fullTitle: 'Course & Programme Submissions Tracker',
          icon: FileCheck2,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: subCount > 0 ? `${subCount}` : null,
          badgeColor: 'bg-teal-100 text-teal-900 border-teal-200',
        },
        {
          id: 'INTAKE_REGISTER' as TabType,
          stageTag: null,
          label: 'Intake Register',
          fullTitle: 'Intake Candidates & Script Ledger',
          icon: TableProperties,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: intakeCount > 0 ? `${intakeCount}` : null,
          badgeColor: 'bg-zinc-200 text-zinc-800 border-zinc-300',
        },
        {
          id: 'MARKS_ENTRY' as TabType,
          stageTag: null,
          label: 'Marks & Awards',
          fullTitle: 'Evaluated Marks & Course Awards',
          icon: Award,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: gradedEvalCount > 0 ? `${gradedEvalCount}` : null,
          badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
        },
        {
          id: 'COURSE_LEDGER' as TabType,
          stageTag: null,
          label: 'Course Packets',
          fullTitle: 'Physical Script Packet Dispatches',
          icon: Layers,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: packetCount > 0 ? `${packetCount}` : null,
          badgeColor: 'bg-zinc-200 text-zinc-800 border-zinc-300',
        },
      ],
    },
    {
      title: 'Management & Control',
      items: [
        {
          id: 'EVALUATORS' as TabType,
          stageTag: null,
          label: 'Evaluator Directory',
          fullTitle: 'Approved Academic Evaluator Panel',
          icon: Users,
          roles: ['ADMIN', 'OFFICIAL'],
          badge: evalDirectoryCount > 0 ? `${evalDirectoryCount}` : null,
          badgeColor: 'bg-zinc-200 text-zinc-800 border-zinc-300',
        },
        {
          id: 'SETTINGS' as TabType,
          stageTag: null,
          label: 'System Settings',
          fullTitle: 'Institution & Cycle Configurations',
          icon: Settings,
          roles: ['ADMIN'],
          adminOnly: true,
          badge: 'Admin',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {!isSidebarHidden && (
        <div
          onClick={() => setIsSidebarHidden(true)}
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 cursor-pointer pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* Main Collapsible & Hideable Sidebar Container */}
      <aside
        id="app-left-sidebar"
        className={`fixed md:sticky top-0 md:top-[73px] h-screen md:h-[calc(100vh-73px)] z-50 md:z-20 bg-white border-r border-zinc-200 flex flex-col shrink-0 shadow-sm transition-all duration-300 ease-in-out ${
          // Width: 260px expanded vs 72px collapsed icon-only rail
          isSidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        } ${
          // Hide / Show on desktop: slide in/out via negative margin and opacity
          isSidebarHidden
            ? '-translate-x-full pointer-events-none md:-translate-x-0 md:-ml-[260px] md:opacity-0 md:pointer-events-none'
            : 'translate-x-0 pointer-events-auto md:ml-0 md:opacity-100'
        }`}
      >
        {/* Sidebar Header Toolbar */}
        <div className="p-3 border-b border-zinc-200 flex items-center justify-between gap-2 bg-zinc-50/70">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-indigo-900 text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                SC
              </div>
              <div className="truncate">
                <div className="text-xs font-black text-zinc-900 tracking-tight truncate">
                  OPERATIONS MENU
                </div>
                <div className="text-[10px] text-zinc-500 truncate">Study Centre SC-2033</div>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="w-8 h-8 rounded-lg bg-indigo-900 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                2033
              </div>
            </div>
          )}

          {/* Action Buttons: Collapse toggle on desktop & Close button on mobile */}
          <div className="flex items-center gap-1">
            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              id="sidebar-collapse-btn"
              type="button"
              onClick={toggleSidebarCollapsed}
              className="hidden md:flex p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 transition cursor-pointer"
              title={isSidebarCollapsed ? 'Expand Menu (260px)' : 'Shrink to Icon-Only Rail (72px)'}
              aria-label="Collapse or Expand Sidebar"
            >
              {isSidebarCollapsed ? (
                <ChevronsRight className="w-4 h-4 text-indigo-700" />
              ) : (
                <ChevronsLeft className="w-4 h-4 text-zinc-600" />
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsSidebarHidden(true)}
              className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-4 h-4 text-zinc-700" />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4 divide-y divide-zinc-100">
          {/* Quick Access: Student Lookup */}
          <div className="pt-1">
            <button
              id="sidebar-student-lookup-btn"
              type="button"
              onClick={() => {
                openSearchModal();
                if (window.innerWidth < 768) {
                  setIsSidebarHidden(true);
                }
              }}
              className={`group w-full flex items-center rounded-xl transition-all cursor-pointer relative bg-zinc-50 hover:bg-indigo-50 border border-zinc-200 hover:border-indigo-300 text-zinc-800 hover:text-indigo-950 font-semibold shadow-2xs ${
                isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-3'
              }`}
              title="Instant Student Status & Evaluation Lookup (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-indigo-600 shrink-0" />
              {!isSidebarCollapsed && (
                <div className="text-left truncate flex-1 flex items-center justify-between">
                  <span className="text-xs truncate font-bold">Student Lookup</span>
                  <span className="text-[10px] text-zinc-500 font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                    Ctrl+K
                  </span>
                </div>
              )}
            </button>
          </div>

          {navSections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => {
                if (userRole === 'desk' || isUrlLockedDeskMode) {
                  // If userRole === 'desk', show ONLY Stage 1 and Stage 2
                  return item.id === 'INTAKE_DESK' || item.id === 'EVALUATION_MASTER';
                }
                return true;
              }),
            }))
            .filter((section) => section.items.length > 0)
            .map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'pt-3' : ''}>
              {/* Section Header */}
              {!isSidebarCollapsed && (
                <div className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>{section.title}</span>
                </div>
              )}

              {/* Section Item Links */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = item.adminOnly && !isAdmin;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        // On small screens, close the drawer on selection
                        if (window.innerWidth < 768) {
                          setIsSidebarHidden(true);
                        }
                      }}
                      className={`group w-full flex items-center rounded-xl transition-all cursor-pointer relative ${
                        isSidebarCollapsed
                          ? 'justify-center p-3'
                          : 'px-3 py-2.5 justify-between'
                      } ${
                        isActive
                          ? 'bg-indigo-950 text-white shadow-xs font-bold'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 font-medium'
                      }`}
                      title={item.fullTitle}
                    >
                      {/* Active Indicator Bar */}
                      {isActive && (
                        <span
                          className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-amber-400 ${
                            isSidebarCollapsed ? 'hidden' : 'block'
                          }`}
                        />
                      )}

                      {/* Icon & Label */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-amber-300'
                                : 'text-zinc-500 group-hover:text-indigo-600'
                            }`}
                          />
                          {/* Collapsed view badge indicator dot / mini badge */}
                          {isSidebarCollapsed && item.badge && (
                            <span
                              className="absolute -top-1.5 -right-2 text-[9px] min-w-3.5 h-3.5 px-0.5 rounded-full font-mono font-bold flex items-center justify-center bg-indigo-600 text-white shadow-2xs ring-1 ring-white"
                              title={item.badge}
                            >
                              {item.badge.length > 2 ? '•' : item.badge}
                            </span>
                          )}
                        </div>

                        {!isSidebarCollapsed && (
                          <div className="text-left truncate">
                            {item.stageTag && (
                              <div
                                className={`text-[9px] uppercase font-bold tracking-wider leading-none mb-0.5 ${
                                  isActive ? 'text-indigo-200' : 'text-indigo-700'
                                }`}
                              >
                                {item.stageTag}
                              </div>
                            )}
                            <div className="text-xs truncate leading-tight">{item.label}</div>
                          </div>
                        )}
                      </div>

                      {/* Expanded View Dynamic Badge Counter */}
                      {!isSidebarCollapsed && (
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          {isRestricted ? (
                            <span
                              className="flex items-center text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-200"
                              title="Restricted to Coordinator (Admin)"
                            >
                              <Lock className="w-2.5 h-2.5 mr-0.5 text-amber-700" />
                              Admin
                            </span>
                          ) : (
                            item.badge && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${
                                  isActive
                                    ? 'bg-white/20 text-white border-white/30'
                                    : item.badgeColor || 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Google Sheets Sync Button */}
        <div className="md:hidden px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={() => syncGoogleSheets(false)}
            disabled={isSyncingSheets}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <span className={`w-2 h-2 rounded-full bg-white ${isSyncingSheets ? 'animate-ping' : ''}`} />
            <span>{syncStatus || (isSyncingSheets ? 'Syncing...' : 'Sync Google Sheets')}</span>
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500">
          {!isSidebarCollapsed ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span>Active Cycle:</span>
                <span className="font-mono text-zinc-800 font-bold">{settings.defaultSession}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span>Role Mode:</span>
                <span className={`font-bold ${isUrlLockedDeskMode ? 'text-teal-700 font-mono' : isAdmin ? 'text-indigo-700' : 'text-teal-700'}`}>
                  {isUrlLockedDeskMode ? 'Desk Official (URL Locked)' : isAdmin ? 'Coordinator (Admin)' : 'Desk Official'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  isAdmin ? 'bg-indigo-600' : 'bg-teal-600'
                }`}
                title={isAdmin ? 'Administrator Mode' : 'Desk Official Mode'}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
