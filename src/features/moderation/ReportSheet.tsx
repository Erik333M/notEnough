import { memo, useEffect, useState } from 'react';
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

import { REPORT_REASON_LABEL, type ReportKind, type ReportReason } from '../../api/moderation';
import { radius } from '../../theme/theme';
import type { Theme } from '../../theme/tokens';
import { useStyles } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader, Toggle } from '../../ui/Controls';
import { TextArea } from '../../ui/Field';

/**
 * Reporting something, in one sheet.
 *
 * A reason is required, because "reported" with no reason is a shrug nobody
 * downstream can act on. The note is optional, because making somebody write
 * an essay at the moment they are upset is how reports stop happening.
 *
 * Blocking is on by default and shown as a switch rather than hidden. Almost
 * nobody reports a person they want to keep seeing, but it stays their
 * decision and they can see it was made.
 */
const REASONS = Object.keys(REPORT_REASON_LABEL) as ReportReason[];

const WHAT: Record<ReportKind, string> = {
  message: 'this message',
  post: 'this post',
  person: 'this person',
};

export const ReportSheet = memo(function ReportSheet({
  kind,
  personName,
  busy = false,
  onClose,
  onSubmit,
}: {
  /** Null closes the sheet. */
  kind: ReportKind | null;
  personName: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, note: string, block: boolean) => void;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(true);

  // A cancelled report must not leak into the next one.
  useEffect(() => {
    if (kind === null) return;
    setReason(null);
    setNote('');
    setBlock(true);
  }, [kind]);

  return (
    <Modal
      visible={kind !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrap}
        >
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grabber} />
            <SectionHeader
              title={`Report ${kind ? WHAT[kind] : ''}`}
              meta={personName}
              action={
                <RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />
              }
            />

            <Text style={styles.label}>WHAT IS WRONG WITH IT?</Text>
            <View style={styles.chips}>
              {REASONS.map((value) => (
                <Chip
                  key={value}
                  label={REPORT_REASON_LABEL[value]}
                  active={reason === value}
                  accent="danger"
                  onPress={() => setReason(value)}
                />
              ))}
            </View>

            <TextArea
              label="Anything to add (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="What happened"
              maxLength={1000}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Also block {personName}</Text>
              <Toggle value={block} onChange={setBlock} accent="danger" />
            </View>
            <Text style={styles.hint}>
              Blocking is immediate and works both ways — neither of you sees the other. Nothing
              either of you recorded is deleted, and you can undo it in Settings.
            </Text>

            <Button
              label="Send the report"
              icon="flag"
              variant="danger"
              loading={busy}
              disabled={!reason}
              onPress={() => reason && onSubmit(reason, note.trim(), block)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.scrim },
    wrap: { maxHeight: '92%' },
    sheet: {
      backgroundColor: theme.surfaceElevated,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    body: { gap: 14, paddingHorizontal: 18, paddingTop: 10 },
    grabber: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.borderStrong,
    },
    label: { fontSize: 11, fontWeight: '800', color: theme.textFaint, letterSpacing: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    toggleLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
    hint: { fontSize: 11.5, lineHeight: 16, fontWeight: '600', color: theme.textFaint },
  });
