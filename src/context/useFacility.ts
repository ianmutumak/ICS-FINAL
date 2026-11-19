import { useCallback, useEffect, useState } from 'react';
import type { DepartmentUnit, IncidentRecord } from '../types';
import { api, errorMessage } from '../lib/api';

interface FacilityDependencies {
  isAuthenticated: boolean;
  hasAdminClearance: boolean;
  reportError: (message: string | null) => void;
}

/** Facility set-up an administrator manages: zones, workstream categories and incidents. */
export function useFacility({ isAuthenticated, hasAdminClearance, reportError }: FacilityDependencies) {
  const [departments, setDepartments] = useState<DepartmentUnit[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setDepartments([]);
      setCategories([]);
      setIncidents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const zones = await api<DepartmentUnit[]>('GET', '/departments');
        if (!cancelled) setDepartments(zones);
        if (hasAdminClearance) {
          const [names, reported] = await Promise.all([
            api<string[]>('GET', '/categories'),
            api<IncidentRecord[]>('GET', '/incidents'),
          ]);
          if (!cancelled) {
            setCategories(names);
            setIncidents(reported);
          }
        }
      } catch (error) {
        if (!cancelled) reportError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasAdminClearance, reportError]);

  /** Runs a request, shows any error, and tells the caller whether it worked. */
  const act = useCallback(async (request: () => Promise<void>) => {
    try {
      await request();
      reportError(null);
      return true;
    } catch (error) {
      reportError(errorMessage(error));
      return false;
    }
  }, [reportError]);

  const addDepartment = (zone: { code: string; name: string; building: string; floor: string; capacity: number; headOfDepartment: string }) =>
    act(async () => {
      const created = await api<DepartmentUnit>('POST', '/departments', zone);
      setDepartments((previous) => [...previous, created]);
    });

  const deleteDepartment = (id: string) =>
    act(async () => {
      await api('DELETE', `/departments/${id}`);
      setDepartments((previous) => previous.filter((zone) => zone.id !== id));
    });

  const addCategory = (name: string) =>
    act(async () => {
      await api('POST', '/categories', { name });
      setCategories((previous) => (previous.includes(name.trim()) ? previous : [...previous, name.trim()].sort()));
    });

  const deleteCategory = (name: string) =>
    act(async () => {
      await api('DELETE', `/categories/${encodeURIComponent(name)}`);
      setCategories((previous) => previous.filter((category) => category !== name));
    });

  const reportIncident = (incident: { title: string; departmentId: string; severity: IncidentRecord['severity']; mitigationNotes?: string }) =>
    act(async () => {
      const created = await api<IncidentRecord>('POST', '/incidents', incident);
      setIncidents((previous) => [created, ...previous]);
    });

  const resolveIncident = (id: string, notes: string, rootCause: string) =>
    act(async () => {
      const resolved = await api<IncidentRecord>('POST', `/incidents/${id}/resolve`, { notes, rootCause });
      setIncidents((previous) => previous.map((incident) => (incident.id === id ? resolved : incident)));
    });

  return {
    departments,
    addDepartment,
    deleteDepartment,
    categories,
    addCategory,
    deleteCategory,
    incidents,
    reportIncident,
    resolveIncident,
  };
}
