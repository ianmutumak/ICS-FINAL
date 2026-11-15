import { useState } from 'react';
import { DepartmentUnit, IncidentRecord, ShiftType, UserStaff } from '../types';
import { SEED_CATEGORIES, SEED_DEPARTMENTS, SEED_INCIDENTS } from '../data/seedData';
import {
  deleteDepartmentFromFirestore,
  saveDepartmentToFirestore,
  saveIncidentToFirestore,
} from '../lib/firestoreService';
import { formatTime, toPublicStaff } from '../lib/shiftRules';
import { STORAGE_KEYS, readStored, usePersistedState } from './storage';

// Categories and a zone that earlier versions pre-filled; they are dropped from stored data.
const RETIRED_DEFAULT_CATEGORIES = new Set([
  'Inbound Staging & Receiving', 'MHE & Equipment Custody', 'Cold Storage & Temperature Vault',
  'Customs & Bonded Freight', 'Hazardous & Dangerous Goods', 'Outbound Marshalling & Dispatch',
  'Facility Safety & Environmental',
]);
const RETIRED_DEPARTMENT_ID = 'dept-imp';

/** Facility set-up an administrator manages: zones, workstream categories and incidents. */
export function useFacility(currentUser: UserStaff) {
  const [departments, setDepartments] = usePersistedState<DepartmentUnit[]>(STORAGE_KEYS.departments, () => {
    const stored = readStored<DepartmentUnit[]>(STORAGE_KEYS.departments);
    return stored ? stored.filter((dept) => dept.id !== RETIRED_DEPARTMENT_ID) : SEED_DEPARTMENTS;
  });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  const [categories, setCategories] = usePersistedState<string[]>(STORAGE_KEYS.categories, () => {
    const stored = readStored<string[]>(STORAGE_KEYS.categories);
    return stored ? stored.filter((category) => !RETIRED_DEFAULT_CATEGORIES.has(category)) : SEED_CATEGORIES;
  });

  const [incidents, setIncidents] = usePersistedState<IncidentRecord[]>(
    STORAGE_KEYS.incidents,
    () => readStored<IncidentRecord[]>(STORAGE_KEYS.incidents) ?? SEED_INCIDENTS
  );

  const addDepartment = (deptData: { code: string; name: string; building: string; floor: string; capacity: number; headOfDepartment: string }) => {
    const capacity = Number(deptData.capacity) || 50;
    const newDept: DepartmentUnit = {
      id: `dept-${Date.now().toString(36)}`,
      code: deptData.code.toUpperCase().trim(),
      name: deptData.name.trim(),
      building: deptData.building.trim(),
      floor: deptData.floor.trim(),
      capacity,
      activeUnits: Math.round(capacity * 0.7),
      headOfDepartment: deptData.headOfDepartment.trim(),
      currentShift: 'morning',
      shiftStatus: 'scheduled',
      roster: { morning: [toPublicStaff(currentUser)], evening: [], night: [] },
    };
    setDepartments((prev) => [...prev, newDept]);
    saveDepartmentToFirestore(newDept);
    return newDept;
  };

  const updateDepartment = (id: string, updatedFields: Partial<DepartmentUnit>) => {
    const dept = departments.find((d) => d.id === id);
    if (!dept) return;
    const modified: DepartmentUnit = { ...dept, ...updatedFields };
    setDepartments((prev) => prev.map((d) => (d.id === id ? modified : d)));
    saveDepartmentToFirestore(modified);
  };

  const deleteDepartment = (id: string) => {
    const remaining = departments.filter((d) => d.id !== id);
    setDepartments(remaining);
    deleteDepartmentFromFirestore(id);
    if (selectedDepartmentId === id && remaining.length > 0) setSelectedDepartmentId(remaining[0].id);
  };

  const assignStaffToRoster = (deptId: string, shiftType: ShiftType, staff: UserStaff) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept || dept.roster[shiftType].some((s) => s.id === staff.id)) return;
    const updatedDept: DepartmentUnit = {
      ...dept,
      roster: { ...dept.roster, [shiftType]: [...dept.roster[shiftType], toPublicStaff(staff)] },
    };
    setDepartments((prev) => prev.map((d) => (d.id === deptId ? updatedDept : d)));
    saveDepartmentToFirestore(updatedDept);
  };

  const addCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const deleteCategory = (category: string) => {
    setCategories((prev) => prev.filter((c) => c !== category));
  };

  const reportIncident = (incidentData: Omit<IncidentRecord, 'id' | 'reportedAt' | 'status'>) => {
    const newIncident: IncidentRecord = {
      ...incidentData,
      id: `inc-${Date.now().toString(36)}`,
      status: 'open',
      reportedAt: formatTime(),
    };
    setIncidents((prev) => [newIncident, ...prev]);
    saveIncidentToFirestore(newIncident);
  };

  const resolveIncident = (incidentId: string, notes: string, rootCause: string) => {
    const incident = incidents.find((inc) => inc.id === incidentId);
    if (!incident) return;
    const resolved: IncidentRecord = {
      ...incident,
      status: 'resolved',
      resolvedBy: currentUser.name,
      resolvedAt: formatTime(),
      mitigationNotes: notes,
      rootCause,
    };
    setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? resolved : inc)));
    saveIncidentToFirestore(resolved);
  };

  return {
    departments,
    setDepartments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    assignStaffToRoster,
    categories,
    addCategory,
    deleteCategory,
    incidents,
    setIncidents,
    reportIncident,
    resolveIncident,
  };
}
