import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  POLICY_SECTIONS,
  POLICY_SUMMARY,
  POLICY_UPDATED,
  type PolicySection,
} from '../features/privacy/policy';
import { accentColor, accentSoft, palette, radius } from '../theme/theme';
import { Appear } from '../ui/Controls';
import { GlassCard } from '../ui/Glass';

/**
 * The privacy policy, in the app.
 *
 * A policy nobody can find is not a policy, and one written in a different
 * register from the rest of the app reads as boilerplate someone pasted in. So
 * this uses the same cards, the same accents and the same plain language as
 * every other screen — and takes its wording from one shared file so it cannot
 * drift out of step with the copy in PRIVACY.md.
 */
export default function PrivacyScreen({ bottomInset }: { bottomInset: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
    >
      <Appear>
        <GlassCard style={styles.hero} elevated>
          <Ionicons name="lock-closed" size={24} color={accentColor.violet} />
          <Text style={styles.heroTitle}>What this app knows about you</Text>
          <Text style={styles.heroCopy}>
            Written to match what the code actually does, not what a template says.
          </Text>

          <View style={styles.summary}>
            {POLICY_SUMMARY.map((line) => (
              <View key={line} style={styles.summaryRow}>
                <Ionicons name="checkmark-circle" size={15} color={accentColor.lime} />
                <Text style={styles.summaryText}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.updated}>Last updated {POLICY_UPDATED}</Text>
        </GlassCard>
      </Appear>

      {POLICY_SECTIONS.map((section, index) => (
        <Appear key={section.id} delay={60 + index * 40}>
          <Section section={section} />
        </Appear>
      ))}

      <Appear delay={60 + POLICY_SECTIONS.length * 40}>
        <Text style={styles.footer}>
          The same policy is kept in PRIVACY.md at the root of the project, so it can be read
          and checked against the source.
        </Text>
      </Appear>
    </ScrollView>
  );
}

const Section = memo(function Section({ section }: { section: PolicySection }) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: accentSoft[section.accent] }]}>
          <Ionicons name={section.icon} size={16} color={accentColor[section.accent]} />
        </View>
        <Text style={styles.title}>{section.title}</Text>
      </View>

      {section.body.map((paragraph) => (
        <Text key={paragraph.slice(0, 24)} style={styles.body}>
          {paragraph}
        </Text>
      ))}

      {section.rows ? (
        <View style={styles.rows}>
          {section.rows.map((row) => (
            <View key={row.term} style={styles.row}>
              <Text style={[styles.term, { color: accentColor[section.accent] }]}>
                {row.term}
              </Text>
              <Text style={styles.detail}>{row.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  hero: {
    gap: 12,
    borderRadius: radius.lg,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: palette.text,
  },
  heroCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
  },
  summary: {
    gap: 9,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: palette.text,
  },
  updated: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
  card: {
    gap: 11,
    borderRadius: radius.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: palette.textMuted,
  },
  rows: {
    gap: 11,
  },
  row: {
    gap: 3,
  },
  term: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
  },
  footer: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
