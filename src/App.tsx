import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { IntakeDesk } from './components/IntakeDesk';
import { CourseSubmissionsTracker } from './components/CourseSubmissionsTracker';
import { IntakeRegister } from './components/IntakeRegister';
import { MarksEntry } from './components/MarksEntry';
import { CourseLedgerView } from './components/CourseLedgerView';
import { CourseEvaluationMaster } from './components/CourseEvaluationMaster';
import { RegionalCentreSEDAwardSheet } from './components/RegionalCentreSEDAwardSheet';
import { EvaluatorDirectory } from './components/EvaluatorDirectory';
import { RemunerationBilling } from './components/RemunerationBilling';
import { SystemSettingsView } from './components/SystemSettingsView';
import { ReceiptModal } from './components/ReceiptModal';
import { RegistrationReceiptModal } from './components/RegistrationReceiptModal';
import { StudentSearchModal } from './components/StudentSearchModal';
import { AdminPinModal } from './components/AdminPinModal';
import { GatekeeperLockScreen } from './components/GatekeeperLockScreen';
import { Toast } from './components/Toast';

const DashboardContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('INTAKE_DESK');
  const {
    currentSession,
    isAdmin,
    isUrlLockedDeskMode,
    userRole,
    settings,
    toastMessage,
    toastType,
    hideToast,
    fetchAllData,
  } = useApp();

  // Automatic Sync on Startup & Login (PC & Mobile)
  React.useEffect(() => {
    fetchAllData();
  }, []);

  // Ensure restricted tabs are redirected in desk mode
  React.useEffect(() => {
    if (userRole === 'desk' || isUrlLockedDeskMode) {
      if (activeTab !== 'INTAKE_DESK' && activeTab !== 'EVALUATION_MASTER') {
        setActiveTab('INTAKE_DESK');
      }
    }
  }, [userRole, isUrlLockedDeskMode, activeTab]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans">
      {/* Institutional Top Header */}
      <Header />

      {/* Main Layout: Collapsible & Hideable Left Sidebar + Responsive Workspace */}
      <div className="flex flex-1 relative">
        {/* Left Sidebar (260px expanded, 72px collapsed rail, or smooth burger hide) */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Workspace Content Area */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
            {activeTab === 'INTAKE_DESK' && <IntakeDesk />}
            {activeTab === 'SUBMISSIONS_TRACKER' && <CourseSubmissionsTracker />}
            {activeTab === 'INTAKE_REGISTER' && <IntakeRegister />}
            {activeTab === 'EVALUATION_MASTER' && <CourseEvaluationMaster />}
            {activeTab === 'SED_AWARD_SHEETS' && <RegionalCentreSEDAwardSheet />}
            {activeTab === 'MARKS_ENTRY' && <MarksEntry />}
            {activeTab === 'COURSE_LEDGER' && <CourseLedgerView />}
            {activeTab === 'EVALUATORS' && <EvaluatorDirectory />}
            {activeTab === 'REMUNERATION' && (!isUrlLockedDeskMode && isAdmin ? <RemunerationBilling /> : <IntakeDesk />)}
            {activeTab === 'SETTINGS' && (!isUrlLockedDeskMode && isAdmin ? <SystemSettingsView /> : <IntakeDesk />)}
          </main>

          {/* Institutional Footer */}
          <footer className="bg-white border-t border-zinc-200 py-4 px-6 text-xs text-zinc-500 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-800">IGNOU SC-2033</span>
                <span>•</span>
                <span>Assignment Operations & Evaluation Cell</span>
                <span>•</span>
                <span className="text-zinc-600 font-mono">Isolated Cycle: {currentSession}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-600' : 'bg-teal-600'}`}></span>
                  Active Role:{' '}
                  <strong className="text-zinc-800">
                    {isUrlLockedDeskMode
                      ? 'Desk Official (Enforced via URL ?mode=desk / ?role=official)'
                      : isAdmin
                      ? 'Administrator (Coordinator)'
                      : 'Desk Official'}
                  </strong>
                </span>
                <span>•</span>
                <span>{settings.regionalCentreCode}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Global Printable Acknowledgment Modal */}
      <ReceiptModal />

      {/* Official Course Registration Receipt Modal (Statutory Non-Financial Acknowledgment Slip) */}
      <RegistrationReceiptModal />

      {/* Module E: Global Student Search & Lookup Modal */}
      <StudentSearchModal />

      {/* Administrator PIN Verification Modal */}
      <AdminPinModal />

      {/* Global Toast Notification */}
      <Toast message={toastMessage} type={toastType} onClose={hideToast} />
    </div>
  );
};

const MainApp: React.FC = () => {
  const { isAuthenticated, toastMessage, toastType, hideToast } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <GatekeeperLockScreen />
        <Toast message={toastMessage} type={toastType} onClose={hideToast} />
      </>
    );
  }

  return <DashboardContent />;
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
