import { useCallback, useEffect, useState } from 'react';
import type { ForecastDecision } from '../lib/auditTrail';
import { api, errorMessage } from '../lib/api';

/** Administrator decisions about forecast warnings: the forecast advises, a person decides. Kept on the server. */
export function useForecastReview(hasAdminClearance: boolean, reportError: (message: string | null) => void) {
  const [forecastDecisions, setForecastDecisions] = useState<ForecastDecision[]>([]);

  useEffect(() => {
    if (!hasAdminClearance) {
      setForecastDecisions([]);
      return;
    }
    let cancelled = false;
    api<ForecastDecision[]>('GET', '/forecast-decisions')
      .then((decisions) => {
        if (!cancelled) setForecastDecisions(decisions);
      })
      .catch(() => {
        // The panel still works without the history.
      });
    return () => {
      cancelled = true;
    };
  }, [hasAdminClearance]);

  const recordForecastDecision = useCallback(
    async (decision: Pick<ForecastDecision, 'metric' | 'date' | 'shift' | 'expected' | 'decision' | 'note'>) => {
      try {
        const saved = await api<ForecastDecision>('POST', '/forecast-decisions', decision);
        setForecastDecisions((previous) => [saved, ...previous]);
        reportError(null);
        return true;
      } catch (error) {
        reportError(errorMessage(error));
        return false;
      }
    },
    [reportError]
  );

  return { forecastDecisions, recordForecastDecision };
}
