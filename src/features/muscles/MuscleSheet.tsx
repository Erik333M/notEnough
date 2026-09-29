import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MUSCLE_LABEL,
  type MuscleWork,
  worksView,
} from '../../state/journey/muscles';
import type { BodyForm } from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { RoundIconButton, SectionHeader, Segmented } from '../../ui/Controls';
import { BodyMap } from './BodyMap';
import { MusclePicker } from './MusclePicker';
import { Button } from '../../ui/Button';

/**
 * What a movement works, on a figure.
 *
 * Both views are shown side by side rather than behind a toggle. A deadlift
 * works the front and the back, and making somebody flip between them to find
 * that out would hide the very thing the picture is for.
 *
 * The figure is a preference, not a claim about anyone: the switch is here
 * rather than buried in settings because this is the screen where it matters,
 * and it changes the drawing and nothing else.
 *
 * A movement you added yourself can be tagged from here. The 223 that ship
 * with the app cannot: they are a reference, and letting each account rewrite
 * them would leave two people disagreeing about what a back squat works.
 */
export function MuscleSheet({
  name,
  work,
  form,
  editable = false,
  onChangeForm,
  onChangeWork,
  onClose,
}: {
  name: string | null;
  work: MuscleWork;
  form: BodyForm;
  /** True for a movement of your own. The shipped catalogue is read-only. */
  editable?: boolean;
  onChangeForm: (form: BodyForm) => void;
  onChangeWork?: (work: MuscleWork) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);

  // Closing and reopening should show the figure, not the form you left open.
  useEffect(() => {
    if (name === null) setEditing(false);
  }, [name]);

  const list = useCallback(
    (groups: typeof work.primary, tone: 'primary' | 'secondary') =>
      groups.map((group) => (
        <View
          key={group}
          style={[styles.chip, tone === 'primary' ? styles.chipPrimary : styles.chipSecondary]}
        >
          <Text style={[styles.chipText, tone === 'primary' && styles.chipTextPrimary]}>
            {MUSCLE_LABEL[group]}
          </Text>
        </View>
      )),
    [],
  );

  const untagged = work.primary.length === 0 && work.secondary.length === 0;

  return (
    <Modal visible={name !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />

          <SectionHeader
            title={name ?? ''}
            meta={editing ? 'Tap what it works' : untagged ? 'Not tagged yet' : 'What it works'}
            action={<RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {editing ? (
              <>
                {/*
                  The figure stays on screen while the chips are tapped. The
                  whole point of tagging is seeing where it lands, and hiding
                  the drawing behind the form would turn it into a quiz.
                */}
                <View style={styles.figures}>
                  <BodyMap work={work} form={form} view="front" height={170} />
                  <BodyMap work={work} form={form} view="back" height={170} />
                </View>
                <MusclePicker work={work} onChange={(next) => onChangeWork?.(next)} />
                <Button label="Done" icon="checkmark" onPress={() => setEditing(false)} />
              </>
            ) : (
              <>
            {untagged ? (
              <Text style={styles.copy}>
                {editable
                  ? 'Nobody has said what this one works yet. Tag it and the figure fills in — it is your movement, so it is your call.'
                  : 'Nothing is tagged on this one.'}
              </Text>
            ) : null}

            <View style={styles.figures}>
              <BodyMap work={work} form={form} view="front" height={200} />
              <BodyMap work={work} form={form} view="back" height={200} />
            </View>

            {!untagged ? (
              <>
                <View style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: '#FF5A5F' }]} />
                  <Text style={styles.legend}>Mainly this</Text>
                  <View style={[styles.dot, { backgroundColor: 'rgba(255,90,95,0.34)' }]} />
                  <Text style={styles.legend}>Also working</Text>
                </View>

                <View style={styles.chips}>{list(work.primary, 'primary')}</View>
                {work.secondary.length > 0 ? (
                  <View style={styles.chips}>{list(work.secondary, 'secondary')}</View>
                ) : null}

                {!worksView(work, 'back') ? (
                  <Text style={styles.note}>Nothing on the back for this one.</Text>
                ) : null}
                {!worksView(work, 'front') ? (
                  <Text style={styles.note}>Nothing on the front for this one.</Text>
                ) : null}
              </>
            ) : null}

            {editable ? (
              <Button
                label={untagged ? 'Say what it works' : 'Change what it works'}
                icon="create-outline"
                variant="ghost"
                onPress={() => setEditing(true)}
              />
            ) : null}

            <View style={styles.formBlock}>
              <Text style={styles.formLabel}>FIGURE</Text>
              <Segmented
                options={[
                  { value: 'male', label: 'Man' },
                  { value: 'female', label: 'Woman' },
                ]}
                value={form}
                onChange={onChangeForm}
              />
              <Text style={styles.note}>
                Changes the drawing only. It is never sent anywhere and changes nothing the app
                expects of you.
              </Text>
            </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,3,10,0.72)' },
  sheet: {
    maxHeight: '92%',
    gap: 12,
    padding: 18,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  body: { gap: 14, paddingBottom: 8 },
  figures: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legend: { fontSize: 11, fontWeight: '700', color: palette.textMuted, marginRight: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  chipPrimary: { backgroundColor: 'rgba(255,90,95,0.18)' },
  chipSecondary: { backgroundColor: 'rgba(255,255,255,0.06)' },
  chipText: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  chipTextPrimary: { color: accentColor.rose },
  note: { fontSize: 11.5, lineHeight: 16.5, fontWeight: '600', color: palette.textFaint },
  formBlock: { gap: 8, marginTop: 4 },
  formLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: palette.textFaint },
});
