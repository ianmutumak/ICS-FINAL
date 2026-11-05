import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Key,
  Flame,
  FileCheck,
  Building2,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  XCircle,
  Eye,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Layers,
  Tag,
  ClipboardList,
} from 'lucide-react';
import { loginWithGoogle, logoutFirebase, auth } from '../../lib/firebase';

export const AdminConsoleView: React.FC = () => {
  const {
    currentUser,
    staffList,
    updateUserRole,
    updateUserStatus,
    activeHandover,
    archive,
    overrideShiftSignoff,
    incidents,
    resolveIncident,
    reportIncident,
    overrideLogs,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    categories,
    addCategory,
    deleteCategory,
    tasks,
    setActiveTab,
  } = useHandover();

  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'shifts' | 'incidents' | 'tasks' | 'overrides' | 'zones'>('users');

  // Override dialog state
  const [selectedShiftToOverride, setSelectedShiftToOverride] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('Emergency surge: Primary lead unavailable; administrative sign-off authorized.');

  // Incident resolution modal state
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [rootCause, setRootCause] = useState('Process protocol delay under high acute workload');

  // New incident report form state
  const [showNewIncidentForm, setShowNewIncidentForm] = useState(false);
  const [newIncTitle, setNewIncTitle] = useState('');
  const [newIncDeptId, setNewIncDeptId] = useState(departments[0]?.id || 'dept-imp');
  const [newIncSeverity, setNewIncSeverity] = useState<'critical' | 'major' | 'moderate' | 'minor'>('major');

  // Dynamic Department / Zone form state
  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptBuilding, setDeptBuilding] = useState('Central Logistics Terminal');
  const [deptFloor, setDeptFloor] = useState('Zone Bay 01-08');
  const [deptCapacity, setDeptCapacity] = useState('1200');
  const [deptSupervisor, setDeptSupervisor] = useState(currentUser.name);

  // Category state
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Firebase auth state indicator
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);

  const handleGoogleAuth = async () => {
    try {
      const user = await loginWithGoogle();
      setFirebaseUser(user);
    } catch (err) {
      console.warn('Google Sign-in prompt:', err);
    }
  };

  const handleGoogleSignout = async () => {
    await logoutFirebase();
    setFirebaseUser(null);
  };

  const allShifts = [activeHandover, ...archive];

  const handleExecuteOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftToOverride || !overrideReason.trim()) return;
    overrideShiftSignoff(selectedShiftToOverride, overrideReason.trim());
    setSelectedShiftToOverride(null);
  };

  const handleExecuteResolveIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId || !resolutionNotes.trim()) return;
    resolveIncident(selectedIncidentId, resolutionNotes.trim(), rootCause.trim());
    setSelectedIncidentId(null);
    setResolutionNotes('');
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncTitle.trim()) return;
    const dept = departments.find((d) => d.id === newIncDeptId);
    reportIncident({
      title: newIncTitle.trim(),
      departmentId: newIncDeptId,
      departmentName: dept?.name || 'Operational Zone',
      severity: newIncSeverity,
      reportedBy: currentUser.name,
      mitigationNotes: 'Reported via Administrative Safety Console.',
    });
    setNewIncTitle('');
    setShowNewIncidentForm(false);
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode.trim() || !deptName.trim()) return;
    addDepartment({
      code: deptCode.trim().toUpperCase(),
      name: deptName.trim(),
      building: deptBuilding.trim(),
      floor: deptFloor.trim(),
      capacity: Number(deptCapacity) || 500,
      headOfDepartment: deptSupervisor.trim(),
    });
    setDeptCode('');
    setDeptName('');
    setShowNewDeptModal(false);
  };


  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;
    addCategory(newCategoryInput.trim());
    setNewCategoryInput('');
  };

  return (
    <div className="space-y-6">
      {/* Admin Header with Security & Access Control Badge */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                Admin Console
              </span>
              <span>·</span>
              <span>Supervisor Controls</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Operations Governance
            </h1>
          </div>

          {/* Right Header Actions: Exit Console + Firebase Cloud Connection */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setActiveTab('active-handover')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer shadow-xs"
            >
              <span>Exit Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {firebaseUser ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-mono text-[11px] truncate max-w-[140px]">{firebaseUser.email}</span>
                <button
                  onClick={handleGoogleSignout}
                  className="text-[10px] underline ml-1 text-slate-500 cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Link Firebase Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs mt-6 overflow-x-auto">
          <button
            onClick={() => setActiveAdminTab('users')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'users'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Users ({staffList.length})
          </button>
          <button
            onClick={() => setActiveAdminTab('zones')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeAdminTab === 'zones'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>Zones ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveAdminTab('shifts')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'shifts'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Shift Override Controls
          </button>
          <button
            onClick={() => setActiveAdminTab('incidents')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'incidents'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Incident Resolution ({incidents.filter((i) => i.status !== 'resolved').length} Open)
          </button>
          <button
            onClick={() => setActiveAdminTab('tasks')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'tasks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Global Task Surveillance ({tasks.length})
          </button>
          <button
            onClick={() => setActiveAdminTab('overrides')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'overrides'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Override Audit Ledger ({overrideLogs.length})
          </button>
        </div>
      </section>

      {/* Tab 1: User & Role Management */}
      {activeAdminTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Warehouse & Operations Workforce Directory
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Configure role elevations, administrative privileges, and duty status
              </span>
            </div>
            <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
              {staffList.filter((s) => s.isAdmin).length} Super Admins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-2.5 px-4 font-semibold">Worker / Operator Name</th>
                  <th className="py-2.5 px-4 font-semibold">Staff Number</th>
                  <th className="py-2.5 px-4 font-semibold">Department</th>
                  <th className="py-2.5 px-4 font-semibold">Role Title</th>
                  <th className="py-2.5 px-4 font-semibold">Privilege Level</th>
                  <th className="py-2.5 px-4 font-semibold">Account Status</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Role Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {staff.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {staff.qualification}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {staff.staffNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {staff.department}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {staff.role}
                    </td>
                    <td className="py-2.5 px-4">
                      {staff.isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded font-bold">
                          <Lock className="w-3 h-3" /> System Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Standard Staff
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          staff.status === 'suspended'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : staff.status === 'on_leave'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {staff.status || 'active'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => updateUserRole(staff.id, staff.role, !staff.isAdmin)}
                          className="px-2 py-1 text-[11px] font-semibold rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {staff.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <select
                          value={staff.status || 'active'}
                          onChange={(e) => updateUserStatus(staff.id, e.target.value as any)}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                        >
                          <option value="active">Active</option>
                          <option value="on_leave">Leave</option>
                          <option value="suspended">Suspend</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Facility Zones & Classifications Management */}
      {activeAdminTab === 'zones' && (
        <div className="space-y-6">
          {/* Sub-header Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Dynamic Facility Operational Zones & Classifications
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Configure facility operational zones, cargo bays, storage aisles, and workstream classifications. All values dynamically populate operator menus and shift creation across the platform.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={() => setShowNewDeptModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Facility Zone</span>
              </button>
            </div>
          </div>

          {/* Section 1: Facility Zones / Departments Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Active Facility Zones & Bays ({departments.length})
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Operating units available for roster assignment and shift turnover
                </span>
              </div>
              <button
                onClick={() => setShowNewDeptModal(true)}
                className="text-xs text-teal-700 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Zone
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-2.5 px-4 font-semibold">Zone Code</th>
                    <th className="py-2.5 px-4 font-semibold">Facility Bay / Zone Name</th>
                    <th className="py-2.5 px-4 font-semibold">Building & Aisle Location</th>
                    <th className="py-2.5 px-4 font-semibold">Capacity</th>
                    <th className="py-2.5 px-4 font-semibold">Zone Supervisor</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                        {dept.code}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {dept.name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                        {dept.building} · {dept.floor}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {dept.capacity.toLocaleString()} Pallets/Units
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {dept.headOfDepartment}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => deleteDepartment(dept.id)}
                          disabled={departments.length <= 1}
                          title={departments.length <= 1 ? 'Minimum 1 zone required' : 'Retire this operational zone'}
                          className={`p-1.5 rounded transition-colors ${
                            departments.length <= 1
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          {/* Section 3: Workstream Classifications / Categories */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Operational Workstream Classifications ({categories.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Categories dynamically available in SBAR forms and workstream filters
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  <span>{cat}</span>
                  {categories.length > 1 && (
                    <button
                      onClick={() => deleteCategory(cat)}
                      title="Remove category"
                      className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Category Form */}
            <form onSubmit={handleAddCategorySubmit} className="flex items-center gap-2 pt-2 max-w-sm">
              <input
                type="text"
                placeholder="New workstream (e.g. Hazardous Materials)"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors shrink-0"
              >
                Add Workstream
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Shift Override Controls */}
      {activeAdminTab === 'shifts' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Shift Override & Emergency Handover Intervention
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Administrators have executive authority to unblock delayed turnovers, arbitrate disputed handovers, and sign off on behalf of delayed personnel with mandatory rationale logging.
            </p>
          </div>

          <div className="space-y-3">
            {allShifts.map((shift) => {
              const isPending = shift.status === 'pending_signoff' || shift.status === 'in_progress';
              return (
                <div
                  key={shift.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                        {shift.handoverCode}
                      </span>
                      <span className="text-xs text-slate-900 dark:text-white font-semibold">
                        · {shift.wardOrDepartment}
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                        {shift.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Outgoing: {shift.leadOutgoing.name} ({shift.leadOutgoing.role}) → Incoming: {shift.leadIncoming.name} ({shift.leadIncoming.role})
                    </div>
                    {shift.isOverridden && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        Overridden by Admin: "{shift.overrideReason}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPending ? (
                      <button
                        onClick={() => setSelectedShiftToOverride(shift.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Executive Override</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sealed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Incident Resolution & Root Cause */}
      {activeAdminTab === 'incidents' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cross-Facility Incident & Safety Hazard Ledger
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track, investigate, and close adverse operational events rolling across shifts
              </p>
            </div>
            <button
              onClick={() => setShowNewIncidentForm(!showNewIncidentForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 rounded-lg cursor-pointer"
            >
              <span>Report Incident</span>
            </button>
          </div>

          {/* New Incident Form */}
          {showNewIncidentForm && (
            <form onSubmit={handleCreateIncident} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3 text-xs">
              <span className="font-bold text-slate-900 dark:text-white block">Log Safety Incident</span>
              <input
                type="text"
                required
                placeholder="Incident Description (e.g. Pallet rack deflection, hydraulic fluid leak, conveyor jam)"
                value={newIncTitle}
                onChange={(e) => setNewIncTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newIncDeptId}
                  onChange={(e) => setNewIncDeptId(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newIncSeverity}
                  onChange={(e) => setNewIncSeverity(e.target.value as any)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 capitalize"
                >
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="moderate">Moderate</option>
                  <option value="minor">Minor</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentForm(false)}
                  className="px-3 py-1 text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  Log Incident
                </button>
              </div>
            </form>
          )}

          {/* Incident Cards */}
          <div className="space-y-3">
            {incidents.map((inc) => {
              const isResolved = inc.status === 'resolved';
              return (
                <div
                  key={inc.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isResolved
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20'
                      : inc.severity === 'critical'
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {inc.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                          inc.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Status: {inc.status}
                      </span>
                      {!isResolved && (
                        <button
                          onClick={() => setSelectedIncidentId(inc.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                        >
                          Resolve & Close
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span>Department: <strong>{inc.departmentName}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>Reported: {inc.reportedAt} by {inc.reportedBy}</span>
                    </div>
                    {inc.mitigationNotes && (
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 italic">
                        "{inc.mitigationNotes}"
                      </p>
                    )}
                    {isResolved && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold pt-1">
                        Resolved by {inc.resolvedBy} at {inc.resolvedAt} · Root Cause: {inc.rootCause}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Global Task Surveillance */}
      {activeAdminTab === 'tasks' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Cross-Facility Task Surveillance & Aging Monitor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Centralized surveillance of pending operational work-orders and carried-over tasks across all warehouse zones
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {departments.map((dept) => {
              const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
              const pendingCount = deptTasks.filter((t) => t.status !== 'completed').length;
              const urgentCount = deptTasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length;
              return (
                <div
                  key={dept.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                    <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[140px]">
                      {dept.name}
                    </span>
                    <span className="font-mono text-[10px] text-teal-700 dark:text-teal-400 font-bold">
                      {dept.code}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Pending Orders:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">{pendingCount}</strong>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Urgent / STAT:</span>
                      <strong className="font-mono">{urgentCount}</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 max-h-36 overflow-y-auto">
                    {deptTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`text-[11px] p-1.5 rounded border ${
                          t.status === 'completed'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through'
                            : t.priority === 'urgent'
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300 font-medium'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="truncate">{t.title}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          Due: {t.dueTime} · {t.assignedTo}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Override Audit Ledger */}
      {activeAdminTab === 'overrides' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Immutable Administrative Override Ledger
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Audit trail of supervisor emergency sign-offs and state overrides
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-2.5 px-4 font-semibold">Shift Code</th>
                  <th className="py-2.5 px-4 font-semibold">Department</th>
                  <th className="py-2.5 px-4 font-semibold">Authorizing Admin</th>
                  <th className="py-2.5 px-4 font-semibold">Action Type</th>
                  <th className="py-2.5 px-4 font-semibold">Documented Rationale</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {overrideLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {log.shiftCode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white">
                      {log.departmentName}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {log.adminName}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-rose-700 dark:text-rose-400">
                      {log.actionType}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
                      "{log.reason}"
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 text-right">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Override Dialog Modal */}
      {selectedShiftToOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Executive Shift Sign-off Override</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You are exercising administrative authority to forcibly sign and complete this shift transition. An immutable audit record will be registered in the operations audit ledger.
            </p>

            <form onSubmit={handleExecuteOverride} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Override Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State operational necessity or supervisor justification..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedShiftToOverride(null)}
                  className="px-3 py-1.5 text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                >
                  Confirm Executive Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Resolution Modal */}
      {selectedIncidentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Investigate & Resolve Safety Incident
            </h3>

            <form onSubmit={handleExecuteResolveIncident} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Root Cause Analysis *
                </label>
                <input
                  type="text"
                  required
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="e.g. Equipment failure, staffing deficit"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Corrective Mitigation Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe resolution taken and steps to prevent recurrence..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentId(null)}
                  className="px-3 py-1.5 text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Mark Resolved & Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Facility Zone */}
      {showNewDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Add New Facility Zone / Bay
              </h3>
              <button
                onClick={() => setShowNewDeptModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Zone Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZONE-5A"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacity (Units) *
                  </label>
                  <input
                    type="number"
                    required
                    value={deptCapacity}
                    onChange={(e) => setDeptCapacity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Facility Zone / Bay Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mezzanine Pick & Automated Sort 5A"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Building / Complex
                  </label>
                  <input
                    type="text"
                    required
                    value={deptBuilding}
                    onChange={(e) => setDeptBuilding(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Floor / Aisle Location
                  </label>
                  <input
                    type="text"
                    required
                    value={deptFloor}
                    onChange={(e) => setDeptFloor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Zone Supervisor
                </label>
                <input
                  type="text"
                  required
                  value={deptSupervisor}
                  onChange={(e) => setDeptSupervisor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewDeptModal(false)}
                  className="px-3 py-1.5 text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Add Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};
