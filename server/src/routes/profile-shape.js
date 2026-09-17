/**
 * The only shape a user takes when somebody else looks at them.
 *
 * Name, streak, level, days won — and nothing that could be turned back into
 * a day of training. Shared by the friends list and the profile route so the
 * two can never drift into showing different amounts.
 *
 * The figures come from what the owner's device published. They are zero
 * until it has, rather than guessed at from anything the server holds.
 */
export const publicProfile = (data, userId) => {
  const user = data.users.find((row) => row.id === userId);
  const profile = data.profiles.find((row) => row.userId === userId);
  return {
    userId,
    name: user?.name ?? 'Athlete',
    // Zeroes until their device has published anything — never a guess.
    streak: profile?.streak ?? 0,
    level: profile?.level ?? 1,
    daysWon: profile?.daysWon ?? 0,
    updatedAt: profile?.updatedAt ?? null,
  };

};
