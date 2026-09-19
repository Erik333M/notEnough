import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle } from 'react-native';

import { avatarSource } from '../api/avatars';
import { gradients, palette } from '../theme/theme';

/**
 * Somebody's face, or their initials.
 *
 * One component rather than an <Image> at each call site, because the fallback
 * is the common case and it has to be identical everywhere: a person with no
 * picture should look the same on their own profile, on a friends list and on
 * a coach's roster.
 *
 * It also has to survive a picture that will not load. The app talks to a
 * server on the local network; that request fails often enough — asleep phone,
 * changed wifi — that a broken-image box would be a normal sight. On failure
 * this falls back to the initials, which is never wrong, only less personal.
 */
export const Avatar = memo(function Avatar({
  name,
  uri,
  size = 40,
  tone = 'soft',
  style,
}: {
  name: string;
  /** The path the server published, not an absolute URL. */
  uri?: string | null;
  size?: number;
  /**
   * `accent` for the one that is you, `soft` for everybody in a list. A
   * screenful of gradients competes with the content; a single one reads as
   * the subject of the screen.
   */
  tone?: 'accent' | 'soft';
  /** Layout only — the shape is this component's business. */
  style?: ImageStyle;
}) {
  const source = avatarSource(uri);
  const [failed, setFailed] = useState(false);

  // A new picture deserves a new attempt; without this, one failure would
  // stick to the slot even after the user picked a different photo.
  useEffect(() => setFailed(false), [source]);

  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={[styles.image, shape, style]}
        onError={() => setFailed(true)}
        accessibilityRole="image"
        accessibilityLabel={`${name}'s picture`}
        resizeMode="cover"
      />
    );
  }

  const letters = (
    <Text
      style={[
        styles.initials,
        { fontSize: size * 0.36 },
        tone === 'soft' && styles.initialsSoft,
      ]}
      allowFontScaling={false}
    >
      {initialsOf(name)}
    </Text>
  );

  if (tone === 'soft') {
    return <View style={[styles.fallback, styles.soft, shape, style]}>{letters}</View>;
  }

  return (
    <LinearGradient
      colors={gradients.accent}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, shape, style]}
    >
      {letters}
    </LinearGradient>
  );
});

/**
 * Up to two letters. A question mark for a name that has none, which happens
 * with a deleted account rather than with anything a person would type.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  image: { backgroundColor: palette.violetSoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  soft: { backgroundColor: palette.violetSoft },
  initials: { fontWeight: '800', color: palette.onAccent },
  initialsSoft: { color: palette.violet },
});
