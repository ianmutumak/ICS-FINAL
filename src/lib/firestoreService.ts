import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  HandoverRecord,
  ShiftActionItem,
  DepartmentUnit,
  IncidentRecord,
  AdminOverrideLog,
} from '../types';

export type SyncState = 'synced' | 'saving' | 'offline' | 'error';

/**
 * Resilient Firestore Persistence Service for ZAMU-CHECK
 * Safely persists records directly into Cloud Firestore while maintaining
 * zero-downtime offline functionality if connection is interrupted.
 */

export async function saveShiftToFirestore(shift: HandoverRecord): Promise<boolean> {
  try {
    const shiftRef = doc(db, 'shifts', shift.id);
    await setDoc(
      shiftRef,
      {
        ...shift,
        _syncedAt: serverTimestamp(),
        lastLocalUpdate: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Firestore: Could not persist shift record to cloud (relying on offline cache):', error);
    return false;
  }
}

export async function saveTaskToFirestore(task: ShiftActionItem): Promise<boolean> {
  try {
    const taskRef = doc(db, 'tasks', task.id);
    await setDoc(
      taskRef,
      {
        ...task,
        _syncedAt: serverTimestamp(),
        lastLocalUpdate: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Firestore: Could not persist task record to cloud:', error);
    return false;
  }
}

export async function deleteTaskFromFirestore(taskId: string): Promise<boolean> {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await deleteDoc(taskRef);
    return true;
  } catch (error) {
    console.warn('Firestore: Could not delete task record in cloud:', error);
    return false;
  }
}

export async function saveDepartmentToFirestore(dept: DepartmentUnit): Promise<boolean> {
  try {
    const deptRef = doc(db, 'departments', dept.id);
    await setDoc(
      deptRef,
      {
        ...dept,
        _syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Firestore: Could not persist department to cloud:', error);
    return false;
  }
}

export async function deleteDepartmentFromFirestore(deptId: string): Promise<boolean> {
  try {
    const deptRef = doc(db, 'departments', deptId);
    await deleteDoc(deptRef);
    return true;
  } catch (error) {
    console.warn('Firestore: Could not delete department from cloud:', error);
    return false;
  }
}

export async function saveIncidentToFirestore(incident: IncidentRecord): Promise<boolean> {
  try {
    const incRef = doc(db, 'incidents', incident.id);
    await setDoc(
      incRef,
      {
        ...incident,
        _syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Firestore: Could not persist incident to cloud:', error);
    return false;
  }
}

export async function saveOverrideToFirestore(log: AdminOverrideLog): Promise<boolean> {
  try {
    const ovrRef = doc(db, 'admin_overrides', log.id);
    await setDoc(
      ovrRef,
      {
        ...log,
        _syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Firestore: Could not persist admin override log to cloud:', error);
    return false;
  }
}

export async function syncAllToFirestore(payload: {
  activeHandover: HandoverRecord;
  tasks: ShiftActionItem[];
  departments: DepartmentUnit[];
  incidents: IncidentRecord[];
}): Promise<boolean> {
  try {
    const p1 = saveShiftToFirestore(payload.activeHandover);
    const p2 = Promise.all(payload.tasks.map((t) => saveTaskToFirestore(t)));
    const p3 = Promise.all(payload.departments.map((d) => saveDepartmentToFirestore(d)));
    const p4 = Promise.all(payload.incidents.map((i) => saveIncidentToFirestore(i)));
    await Promise.all([p1, p2, p3, p4]);
    return true;
  } catch (err) {
    console.warn('Full cloud sync noticed offline state:', err);
    return false;
  }
}

export async function loadInitialFromFirestore(): Promise<{
  shifts?: HandoverRecord[];
  tasks?: ShiftActionItem[];
  departments?: DepartmentUnit[];
  incidents?: IncidentRecord[];
} | null> {
  try {
    const [shiftsSnap, tasksSnap, deptsSnap, incidentsSnap] = await Promise.all([
      getDocs(collection(db, 'shifts')).catch(() => null),
      getDocs(collection(db, 'tasks')).catch(() => null),
      getDocs(collection(db, 'departments')).catch(() => null),
      getDocs(collection(db, 'incidents')).catch(() => null),
    ]);

    const result: {
      shifts?: HandoverRecord[];
      tasks?: ShiftActionItem[];
      departments?: DepartmentUnit[];
      incidents?: IncidentRecord[];
    } = {};

    if (shiftsSnap && !shiftsSnap.empty) {
      result.shifts = shiftsSnap.docs.map((d) => d.data() as HandoverRecord);
    }
    if (tasksSnap && !tasksSnap.empty) {
      result.tasks = tasksSnap.docs.map((d) => d.data() as ShiftActionItem);
    }
    if (deptsSnap && !deptsSnap.empty) {
      result.departments = deptsSnap.docs.map((d) => d.data() as DepartmentUnit);
    }
    if (incidentsSnap && !incidentsSnap.empty) {
      result.incidents = incidentsSnap.docs.map((d) => d.data() as IncidentRecord);
    }

    return result;
  } catch (err) {
    console.warn('Could not read initial records from Firestore (using local state):', err);
    return null;
  }
}
