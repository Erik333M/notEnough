import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Stack } from '../lib/useStack';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { BackHandler } from 'react-native';

/**
 * A tab that has depth: the back bar, the hardware-back wiring, and the screen.
 *
 * Every tab with a stack needs exactly these three things, and writing them
 * per tab is how three of them ended up subtly different. The bar sits outside
 * the child rather than inside it, so it stays put while the screen scrolls
 * and so a screen does not have to know it is nested — the ones below this
 * were written before tabs had depth at all and still take only `bottomInset`.
 */
export function TabStack<View_>({
  stack,
  title,
  meta,
  backLabel = 'Back',
  children,
}: {
  stack: Stack<View_>;
  /** Null on the root view, where there is nothing to go back to. */
  title: string | null;
  meta?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!stack.canGoBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stack.back();
      return true;
    });
    return () => sub.remove();
  }, [stack]);

  return (
    <View style={styles.root}>
      {title !== null ? (
        <View style={styles.bar}>
          <StackHeaderBar title={title} meta={meta} onBack={stack.back} backLabel={backLabel} />
        </View>
      ) : null}
      <View style={styles.screen}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 18, paddingBottom: 6 },
  screen: { flex: 1 },
});
