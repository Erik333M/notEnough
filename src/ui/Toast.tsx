import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, palette, radius, shadow, type AccentName } from '../theme/theme';
import type { IconName } from '../state/types';

type ToastKind = 'success' | 'info' | 'error';

type Toast = { id: number; message: string; kind: ToastKind };

type ToastContextValue = { notify: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_ICON: Record<ToastKind, IconName> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  error: 'alert-circle',
};

const KIND_ACCENT: Record<ToastKind, AccentName> = {
  success: 'lime',
  info: 'cyan',
  error: 'rose',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    counter.current += 1;
    setToast({ id: counter.current, message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={SlideInUp.springify().damping(18)}
          exiting={SlideOutUp.duration(220)}
          pointerEvents="none"
          // Clears the header block (42pt control + padding) instead of
          // covering the screen title.
          style={[styles.wrap, { top: insets.top + 66 }]}
        >
          <View style={styles.toast}>
            <Ionicons
              name={KIND_ICON[toast.kind]}
              size={18}
              color={accentColor[KIND_ACCENT[toast.kind]]}
            />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20,24,48,0.94)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    maxWidth: '100%',
    ...(shadow.float as object),
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
});
