import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EventInput } from '../../api/events';
import { addDays, dayKey } from '../../lib/time';
import { palette } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Stepper } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { durationLabel, endDateFor, formatDay } from './eventCopy';

/**
 * Setting up an event, and editing one — the same form both times.
 *
 * Dates are two steppers, not a calendar: a start expressed as days from today
 * and a length in days. That is how somebody actually describes a camp ("the
 * first week of July, ten days"), it needs no date-picker dependency, and it
 * makes the 1–60 day rule visible in the control rather than a error message
 * after the fact.
 */
export const EventForm = memo(function EventForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: EventInput;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: EventInput) => void;
}) {
  const today = dayKey();
  const [name, setName] = useState(initial?.name ?? '');
  const [offset, setOffset] = useState(() => daysBetween(today, initial?.startDate ?? today));
  const [days, setDays] = useState(() =>
    initial ? daysBetween(initial.startDate, initial.endDate) + 1 : 7,
  );
  const [ageMin, setAgeMin] = useState(initial?.ageMin ?? 0);
  const [ageMax, setAgeMax] = useState(initial?.ageMax ?? 99);
  const [capacity, setCapacity] = useState(initial?.capacity ?? 30);
  const [staffTarget, setStaffTarget] = useState(initial?.staffTarget ?? 3);

  const startDate = dayKey(addDays(new Date(`${today}T00:00:00`), offset));
  const endDate = endDateFor(startDate, days);

  return (
    <View style={styles.wrap}>
      <Field
        label="What is it called?"
        value={name}
        onChangeText={setName}
        placeholder="Summer Camp"
        icon="flag-outline"
      />

      <Stepper
        label="Starts"
        value={offset}
        display={offset === 0 ? 'Today' : formatDay(startDate)}
        onChange={setOffset}
        min={0}
        max={365}
      />
      <Stepper
        label="Runs for"
        value={days}
        display={durationLabel(days)}
        onChange={setDays}
        min={1}
        max={60}
      />
      <Text style={styles.note}>
        {days === 1 ? `On ${formatDay(startDate)}` : `${formatDay(startDate)} to ${formatDay(endDate)}`}
      </Text>

      <Stepper
        label="How many campers fit"
        value={capacity}
        display={String(capacity)}
        onChange={setCapacity}
        min={1}
        max={500}
      />
      <Stepper
        label="Staff you need"
        value={staffTarget}
        display={String(staffTarget)}
        onChange={setStaffTarget}
        min={1}
        max={100}
      />

      {/*
        Ages are a label on the event, not a check on anybody. The app holds no
        birthdates and is not going to start holding them to enforce this.
      */}
      <Stepper
        label="Youngest age"
        value={ageMin}
        display={ageMin === 0 ? 'Any' : String(ageMin)}
        onChange={(next) => {
          setAgeMin(next);
          if (next > ageMax) setAgeMax(next);
        }}
        min={0}
        max={99}
      />
      <Stepper
        label="Oldest age"
        value={ageMax}
        display={ageMax >= 99 ? 'Any' : String(ageMax)}
        onChange={(next) => {
          setAgeMax(next);
          if (next < ageMin) setAgeMin(next);
        }}
        min={0}
        max={99}
      />
      <Text style={styles.note}>
        Who it is for. The app never asks anyone their age, so this is a note to
        people reading, not a door.
      </Text>

      <Button
        label={submitLabel}
        icon="checkmark"
        loading={busy}
        disabled={name.trim().length < 2}
        onPress={() =>
          onSubmit({ name: name.trim(), startDate, endDate, ageMin, ageMax, capacity, staffTarget })
        }
      />
    </View>
  );
});

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { fontSize: 11.5, lineHeight: 16, fontWeight: '600', color: palette.textFaint },
});
