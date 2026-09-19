import { avatarUrlFor } from '../avatar-store.js';

/**
 * The only shape a user takes when somebody else looks at them.
 *
 * Name, picture, streak, level, days won — and nothing that could be turned
 * back into a day of training. Shared by the friends list and the profile
 * route so the two can never drift into showing different amounts.
 *
 * The figures come from what the owner's device published. They are zero
 * until it has, rather than guessed at from anything the server holds.
 */
export const publicProfile = (data, userId) => {
  const user = data.users.find((row) => row.id === userId);
  const profile = data.profiles.find((row) => row.userId === userId);
  const avatar = data.avatars.find((row) => row.userId === userId);
  return {
    userId,
    name: user?.name ?? 'Athlete',
    // A picture is exactly as public as the name beside it, and travels with
    // it — so anywhere a name is allowed a face is too, and nowhere else.
    avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
    // Zeroes until their device has published anything — never a guess.
    streak: profile?.streak ?? 0,
    level: profile?.level ?? 1,
    daysWon: profile?.daysWon ?? 0,
    updatedAt: profile?.updatedAt ?? null,
  };

};
