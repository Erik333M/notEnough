import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { avatarUrlFor } from '../avatar-store.js';
import { areFriends, canRemoveShare } from '../permissions.js';
import { SHARE_PAGE, requireShareInput } from '../validate.js';

/**
 * What your friends have shown off.
 *
 * The same `shares` rows as a team wall, with `teamId` null — which is what
 * "to my friends" means here. A post belongs either to a squad or to the
 * people you have actually added, never to both and never to everybody: there
 * is no public timeline in this app and no way to reach somebody who has not
 * accepted you.
 *
 * The audience is worked out at read time from live friendships rather than
 * stamped on the post. Unfriending somebody therefore takes your posts back
 * from them, which is what a person would expect it to do.
 */
export const friendFeedRouter = Router();

friendFeedRouter.use(requireAuth);

const shape = (data, row) => {
  const avatar = data.avatars.find((entry) => entry.userId === row.userId);
  return { ...row, avatarUrl: avatar ? avatarUrlFor(avatar.file) : null };
};

/**
 * Your feed: your own posts and your friends', newest first.
 *
 * Your own are included deliberately. A feed that hides what you posted makes
 * people post twice to check it worked.
 */
friendFeedRouter.get('/feed', async (req, res, next) => {
  try {
    const data = await read();
    const userId = req.user.id;

    /*
     * Rows that involve you, then the other person in each.
     *
     * The membership test has to come first. Mapping "the other side" over a
     * row you are not part of does not return nothing — it returns whichever
     * end the ternary falls through to, so every accepted friendship in the
     * system would have quietly added a stranger to your friend list. It did,
     * until a test caught it.
     */
    const friends = new Set(
      data.friendships
        .filter(
          (row) =>
            row.status === 'accepted' &&
            (row.requesterId === userId || row.addresseeId === userId),
        )
        .map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId))
        .filter((id) => id !== userId),
    );

    const feed = data.shares
      .filter((row) => !row.teamId && (row.userId === userId || friends.has(row.userId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, SHARE_PAGE)
      .map((row) => shape(data, row));

    return res.json({ feed, friendCount: friends.size });
  } catch (error) {
    return next(error);
  }
});

/** Post to your friends. No team, no audience to choose — it is everybody you added. */
friendFeedRouter.post('/shares', async (req, res, next) => {
  try {
    const input = requireShareInput(req.body);
    const userId = req.user.id;
    const name = req.user.name;

    const share = await write((data) => {
      // Posting the same achievement twice is a double tap or a stale screen,
      // not an intention. The existing post wins and the caller gets it back.
      const existing = data.shares.find(
        (row) => !row.teamId && row.userId === userId && row.achievementId === input.achievementId,
      );
      if (existing) return { row: existing, duplicate: true };

      const row = {
        id: crypto.randomUUID(),
        // Null is the whole difference between this and a team wall post.
        teamId: null,
        userId,
        // Denormalised so the feed reads without a join, and so a later rename
        // does not silently rewrite what a post said at the time.
        authorName: name,
        ...input,
        createdAt: new Date().toISOString(),
      };
      data.shares.push(row);
      return { row, duplicate: false };
    });

    const data = await read();
    return res
      .status(share.duplicate ? 200 : 201)
      .json({ share: shape(data, share.row) });
  } catch (error) {
    return next(error);
  }
});

/** Take yours down. Only yours: a friend feed has no moderator. */
friendFeedRouter.delete('/shares/:shareId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const removed = await write((data) => {
      const share = data.shares.find((row) => row.id === req.params.shareId && !row.teamId);
      // canRemoveShare falls through to a coach check, which answers false for
      // a null team — so on this feed it means the author and nobody else.
      if (!share || !canRemoveShare(data, userId, share)) return false;
      data.shares = data.shares.filter((row) => row.id !== share.id);
      return true;
    });

    if (!removed) {
      return res.status(403).json({ error: 'forbidden', message: 'That is not your post.' });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

/** Exposed for the tests: proves the audience is friendship, not a stamp. */
export const visibleTo = (data, viewerId, share) =>
  !share.teamId && (share.userId === viewerId || areFriends(data, viewerId, share.userId));
