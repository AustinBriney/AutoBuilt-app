import { useCallback, useEffect, useState } from 'react';

// Generic loading/error/data hook so every screen gets consistent
// loading/empty/error states without reimplementing the same three flags.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const run = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    fn()
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => setState({ status: 'error', data: null, error: error.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
}
