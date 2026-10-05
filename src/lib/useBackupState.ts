import { useCallback, useEffect, useRef, useState } from 'react';
import { desktop, errorMessage, isDesktop } from './desktop';
import type { BackupState } from './types';

export function useBackupState(enabled: boolean) {
  const [state, setState] = useState<BackupState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(-1);
  const mounted = useRef(false);
  const accept = useCallback((value: BackupState) => {
    if (!mounted.current || value.revision < revision.current) return;
    revision.current = value.revision;
    setState(value);
    setError(null);
  }, []);
  const refresh = useCallback(async () => {
    try {
      accept(await desktop.backupState());
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    }
  }, [accept]);
  useEffect(() => {
    if (!enabled || !isDesktop) return;
    mounted.current = true;
    const unsubscribe = desktop.onBackupUpdate(accept);
    void refresh();
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [enabled, accept, refresh]);
  useEffect(() => {
    if (!enabled || !isDesktop || state?.operation === 'idle') return;
    // Recover a lost progress/completion event without retrying the operation itself.
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void refresh().finally(() => {
        pending = false;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled, state?.operation, refresh]);
  return { state, error, accept, refresh };
}
