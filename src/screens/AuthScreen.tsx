import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { gradients, palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Controls';
import { Field } from '../ui/Field';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';
import { PressableScale } from '../ui/Touchable';

type Mode = 'login' | 'register';

const MODES = [
  { value: 'login' as Mode, label: 'Sign in' },
  { value: 'register' as Mode, label: 'Create account' },
];

type Errors = { name?: string | null; email?: string | null; password?: string | null };

/** Shown when the API is unreachable — with the URL, so it is actually fixable. */
const OfflineBanner = memo(function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <View style={styles.offline}>
        <Ionicons name="cloud-offline" size={16} color={palette.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.offlineTitle}>Can&apos;t reach the server</Text>
          <Text style={styles.offlineCopy} numberOfLines={2}>
            Start the API with <Text style={styles.offlineCode}>npm start</Text> in /server, then
            retry. Trying {API_BASE_URL}.
          </Text>
        </View>
        <PressableScale onPress={onRetry} haptic="light" scaleTo={0.9}>
          <Ionicons name="refresh" size={18} color={palette.amber} />
        </PressableScale>
      </View>
    </Animated.View>
  );
});

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { notify } = useToast();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setErrors({});
  }, []);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErrors({});
    setUnreachable(false);

    const result =
      mode === 'login' ? await login(email, password) : await register(name, email, password);

    if (!result.ok) {
      // A network failure is not a field error — it needs its own explanation,
      // because nothing the user types will fix it.
      if (result.field === 'network') {
        setUnreachable(true);
        notify(result.message, 'error');
      } else {
        setErrors({ [result.field]: result.message });
      }
      setBusy(false);
      return;
    }

    notify(mode === 'login' ? 'Welcome back.' : 'Account created. Let’s work.', 'success');
    setBusy(false);
  }, [busy, email, login, mode, name, notify, password, register]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(420)} style={styles.brandBlock}>
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mark}
          >
            <Ionicons name="flash" size={26} color={palette.onAccent} />
          </LinearGradient>
          <Text style={styles.brand}>NOTenough</Text>
          <Text style={styles.tagline}>
            Daily goals, honest tracking, and a bar that keeps moving.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420)}>
          <GlassCard style={styles.card} elevated>
            <Segmented options={MODES} value={mode} onChange={switchMode} />

            {unreachable ? <OfflineBanner onRetry={submit} /> : null}

            <Animated.View layout={LinearTransition.springify().damping(20)} style={styles.form}>
              {mode === 'register' ? (
                <Animated.View entering={FadeIn.duration(220)}>
                  <Field
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="Alex Carter"
                    icon="person-outline"
                    error={errors.name}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </Animated.View>
              ) : null}

              <Field
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                icon="mail-outline"
                error={errors.email}
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <Field
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                icon="lock-closed-outline"
                secure
                error={errors.password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                returnKeyType="go"
                onSubmitEditing={submit}
              />

              <Button
                label={mode === 'login' ? 'Sign in' : 'Create account'}
                icon="arrow-forward"
                size="lg"
                loading={busy}
                onPress={submit}
              />
            </Animated.View>

            <Text style={styles.note}>
              <Ionicons name="lock-closed" size={11} color={palette.textFaint} /> Passwords are
              hashed with scrypt and a per-account salt on the server. The device stores a signed
              token in the Keychain — never your password.
            </Text>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(320)} style={styles.footer}>
          <Text style={styles.footerText}>
            {mode === 'login' ? 'New here?' : 'Already training with us?'}
          </Text>
          <Text
            style={styles.footerLink}
            onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
            suppressHighlighting
          >
            {mode === 'login' ? 'Create an account' : 'Sign in instead'}
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    gap: 22,
    justifyContent: 'center',
    flexGrow: 1,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.textFaint,
    textAlign: 'center',
    maxWidth: 260,
    fontWeight: '600',
  },
  card: {
    gap: 18,
    borderRadius: radius.xl,
    padding: 20,
  },
  form: {
    gap: 14,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,182,92,0.12)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,182,92,0.35)',
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.amber,
  },
  offlineCopy: {
    fontSize: 11,
    lineHeight: 16,
    color: palette.textMuted,
    marginTop: 2,
  },
  offlineCode: {
    fontWeight: '800',
    color: palette.text,
  },
  note: {
    fontSize: 11,
    lineHeight: 17,
    color: palette.textFaint,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: palette.textFaint,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.violet,
  },
});
