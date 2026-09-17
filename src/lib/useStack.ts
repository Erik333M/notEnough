import { useCallback, useMemo, useReducer } from 'react';

/**
 * A small typed navigation stack, owned by one tab.
 *
 * The app shell is a flat switch over five routes with no params and no
 * history — which is right for a tab bar and useless for "the entry for 12
 * March" or "this athlete's session". Rather than bring in a navigator for
 * that, each tab that needs depth keeps a stack of its own.
 *
 * Views are a discriminated union supplied by the caller, so a screen cannot
 * be pushed without the data it needs — the failure a param-less flat switch
 * invites. The root is always present, so `current` is never undefined.
 *
 * This was written three times (Journey, Teams, and then twice more) before it
 * was worth extracting; it is deliberately the smallest thing that serves all
 * of them rather than a general router.
 */
export type Stack<View> = {
  current: View;
  canGoBack: boolean;
  /** Depth, so a screen can tell whether it is the root of its tab. */
  depth: number;
  push: (view: View) => void;
  back: () => void;
  /** Returns to the root — what re-selecting a tab should do. */
  reset: () => void;
};

type Action<View> = { type: 'push'; view: View } | { type: 'pop' } | { type: 'reset' };

export function useStack<View>(root: View): Stack<View> {
  const [views, dispatch] = useReducer(
    (state: View[], action: Action<View>): View[] => {
      switch (action.type) {
        case 'push':
          return [...state, action.view];
        case 'pop':
          // Never pops the root: the tab must always render something.
          return state.length > 1 ? state.slice(0, -1) : state;
        case 'reset':
          return state.length === 1 ? state : [state[0]];
        default:
          return state;
      }
    },
    [root],
  );

  const push = useCallback((view: View) => dispatch({ type: 'push', view }), []);
  const back = useCallback(() => dispatch({ type: 'pop' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return useMemo(
    () => ({
      current: views[views.length - 1],
      canGoBack: views.length > 1,
      depth: views.length - 1,
      push,
      back,
      reset,
    }),
    [views, push, back, reset],
  );
}
