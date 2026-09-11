import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { templatesByGroup } from '../../state/journey/habits';
import type { HabitGroup, HabitTemplate } from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { RoundIconButton, SectionHeader } from '../../ui/Controls';
import { PressableScale } from '../../ui/Touchable';
import { NewHabitForm } from './NewHabitForm';

/**
 * Browse the starter habits, or write your own.
 *
 * Templates are only suggestions: adopting one copies its wording into a habit
 * of your own, so editing the seed file later never rewrites a habit someone is
 * already running. Anything already adopted is filtered out before it gets
 * here, so the list only ever shows things you could actually add.
 */
type Props = {
  visible: boolean;
  templates: HabitTemplate[];
  onClose: () => void;
  onAdopt: (template: HabitTemplate) => void;
  onCreate: (title: string, group: HabitGroup) => void;
};

export function HabitTemplateSheet({
  visible,
  templates,
  onClose,
  onAdopt,
  onCreate,
}: Props) {
  const insets = useSafeAreaInsets();
  const grouped = templatesByGroup(templates);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            <SectionHeader
              title="Add a habit"
              meta="Pick one, or write your own"
              action={
                <RoundIconButton
                  icon="close"
                  size={34}
                  onPress={onClose}
                  accessibilityLabel="Close"
                />
              }
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              {/* Remounted per opening, so a cancelled draft never returns. */}
              <NewHabitForm key={visible ? 'open' : 'closed'} onCreate={onCreate} />

              {grouped.length > 0 ? (
                <Text style={styles.suggestLabel}>OR START FROM ONE OF THESE</Text>
              ) : (
                <Text style={styles.allAdopted}>
                  You have adopted every suggestion. Write your own above.
                </Text>
              )}

              {grouped.map((section) => (
                <View key={section.group} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.label.toUpperCase()}</Text>
                  {section.items.map((template) => (
                    <TemplateRow key={template.id} template={template} onAdopt={onAdopt} />
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function TemplateRow({
  template,
  onAdopt,
}: {
  template: HabitTemplate;
  onAdopt: (template: HabitTemplate) => void;
}) {
  const handlePress = useCallback(() => onAdopt(template), [template, onAdopt]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic="medium"
      scaleTo={0.98}
      accessibilityLabel={`Adopt: ${template.title}`}
      style={styles.templateRow}
    >
      <Ionicons name="add-circle-outline" size={17} color={accentColor.lime} />
      <Text style={styles.templateText} numberOfLines={1}>
        {template.title}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,3,10,0.72)',
  },
  sheetWrap: {
    height: '90%',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  content: {
    gap: 16,
    paddingBottom: 16,
  },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: palette.textFaint,
    textAlign: 'center',
  },
  allAdopted: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
    marginBottom: 4,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
    marginBottom: 6,
  },
  templateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
});
