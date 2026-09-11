import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A text field that keeps its own draft and saves itself.
 *
 * Dispatching every keystroke into the app reducer would re-render every
 * consumer of app state on each character; holding the draft locally and
 * committing on a debounce keeps typing at local-state speed while still
 * satisfying "nothing is ever lost". There is no Save button anywhere in the
 * daily entry, so the commit has to be unmissable instead:
 *
 *  - after `delay` ms of no typing
 *  - on blur
 *  - on unmount, which covers navigating away mid-word
 *  - when the app leaves the foreground, which covers being backgrounded or
 *    killed before the debounce fires
 *
 * External updates (a sync adopting another device's copy) are only taken
 * while the field is clean, so an incoming write can never overwrite a
 * half-typed sentence under the user's cursor.
 */
export function useAutosaveText(
  value: string,
  commit: (next: string) => void,
  delay = 450,
): {
  draft: string;
  onChangeText: (next: string) => void;
  flush: () => void;
} {
  const [draft, setDraft] = useState(value);

  const draftRef = useRef(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Held in a ref so a caller passing an inline arrow does not re-arm anything.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    commitRef.current(draftRef.current);
  }, []);

  const onChangeText = useCallback(
    (next: string) => {
      draftRef.current = next;
      dirty.current = true;
      setDraft(next);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  // Adopt an external change only when there is nothing pending locally.
  useEffect(() => {
    if (dirty.current) return;
    if (value === draftRef.current) return;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  // Leaving the foreground is the last safe moment to commit.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Unmount covers navigating away, closing a sheet, or switching dates.
  useEffect(() => flush, [flush]);

  return { draft, onChangeText, flush };
}
