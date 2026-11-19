import type { ForecastDecision } from '../lib/auditTrail';
import type { UserStaff } from '../types';
import { STORAGE_KEYS, readStored, usePersistedState } from './storage';

/** Administrator decisions about forecast warnings: the forecast advises, a person decides. */
export function useForecastReview(currentUser: UserStaff) {
  const [forecastDecisions, setForecastDecisions] = usePersistedState<ForecastDecision[]>(
    STORAGE_KEYS.forecastReview,
    () => readStored<ForecastDecision[]>(STORAGE_KEYS.forecastReview) ?? []
  );

  const recordForecastDecision = (decision: Pick<ForecastDecision, 'metric' | 'date' | 'shift' | 'expected' | 'decision' | 'note'>) => {
    const record: ForecastDecision = {
      ...decision,
      id: `fc-${Date.now().toString(36)}`,
      note: decision.note.trim(),
      by: currentUser.name,
      byId: currentUser.id,
      at: new Date().toISOString(),
    };
    setForecastDecisions((prev) => [record, ...prev]);
  };

  return { forecastDecisions, recordForecastDecision };
}
