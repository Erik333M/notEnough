import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '../theme/theme';

/**
 * Catches a render-time crash and shows what happened.
 *
 * Without one of these a thrown error unmounts the whole tree: on a device you
 * get a blank screen or Expo Go dropping you back to its home list, with the
 * cause visible only in a Metro log you may not be looking at. That makes a
 * device-only bug almost impossible to report.
 *
 * This is not error *recovery* — the app is broken at that point and pretending
 * otherwise would hide it. It exists so the message reaches the person holding
 * the phone, where it can be read out or screenshotted.
 *
 * A native crash (a bad call inside a native module) still bypasses this;
 * React only sees JavaScript.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Goes to the Metro console, where the stack is easier to read than on a
    // phone screen.
    console.error('[ErrorBoundary]', error?.message, info?.componentStack);
    this.setState({ info: info?.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>The app hit an error</Text>
          <Text style={styles.copy}>
            This screen is here so the message is visible on the device rather than only in
            the terminal. Reload to try again.
          </Text>

          <View style={styles.box}>
            <Text style={styles.label}>MESSAGE</Text>
            <Text style={styles.mono}>{error.message || String(error)}</Text>
          </View>

          {error.stack ? (
            <View style={styles.box}>
              <Text style={styles.label}>STACK</Text>
              <Text style={styles.mono}>{error.stack.split('\n').slice(0, 12).join('\n')}</Text>
            </View>
          ) : null}

          {info ? (
            <View style={styles.box}>
              <Text style={styles.label}>COMPONENT</Text>
              <Text style={styles.mono}>{info.split('\n').slice(0, 10).join('\n')}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg0,
  },
  content: {
    padding: 22,
    paddingTop: 72,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
  },
  box: {
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: palette.textFaint,
  },
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: palette.text,
    fontFamily: 'Courier',
  },
});
