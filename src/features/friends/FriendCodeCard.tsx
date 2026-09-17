import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { gradients, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';

/**
 * Your code, and the one-tap way to send it.
 *
 * Both routes to a friend go through this card: read the six characters out
 * across a gym, or push them through whatever messaging app the person
 * already uses. There is no search anywhere in this feature — a directory
 * would also be a way to find out who has an account — so this is how anyone
 * reaches anyone.
 *
 * Sharing uses the platform sheet, which means no dependency and no guessing
 * at which app somebody prefers. The link carries the code so the other side
 * does not retype it, and the message still reads sensibly to anyone who does
 * not have the app.
 */
export const FriendCodeCard = memo(function FriendCodeCard({
  code,
  name,
}: {
  code: string | null;
  name: string;
}) {
  const share = useCallback(async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `${name} wants to train alongside you on NOTenough. Open this to add them:\nnotenough://friend/${code}\n\nOr enter the code ${code} under Profile → Friends.`,
      });
    } catch {
      // Dismissing the sheet throws on some platforms. Nothing to recover.
    }
  }, [code, name]);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none', opacity: 0.16 }]}
      />

      <View style={styles.head}>
        <Ionicons name="person-add-outline" size={15} color={palette.violet} />
        <Text style={styles.label}>YOUR FRIEND CODE</Text>
      </View>

      <Text
        style={styles.code}
        accessibilityLabel={code ? `Your friend code is ${code.split('').join(' ')}` : 'Loading your code'}
      >
        {code ?? '······'}
      </Text>

      <Text style={styles.copy}>
        Give this to someone and they can add you. It never expires, and it tells them nothing
        except that it is yours.
      </Text>

      <Button
        label="Share my code"
        icon="share-outline"
        variant="glass"
        disabled={!code}
        onPress={share}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 18,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: palette.textFaint },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 8, color: palette.text },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
