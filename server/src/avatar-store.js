import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.js';
import { ValidationError } from './validate.js';

/**
 * Avatar bytes, kept out of the database.
 *
 * The db is one JSON file that is read and re-serialised on every single
 * write. Putting a 60 KB image in it would mean rewriting every avatar in the
 * system each time anybody logged a rep. So the bytes live as files and the db
 * holds one short row per person saying which file is theirs.
 *
 * The file name is a random token rather than the user's id, and it is
 * regenerated on every upload. That is what lets the image be served to a
 * plain <Image> with no Authorization header: the URL is the capability, and
 * it is only ever handed to somebody the profile rules already let through.
 * The honest limit of that: a person who saw your avatar keeps a working URL
 * to that copy until you replace it. For a picture that is as public as your
 * name, that is the right trade against breaking images on the web build,
 * where React Native cannot attach headers to an image request.
 */

/** Generous for a 512px square, far too small to be a photo dump. */
const MAX_BYTES = 400 * 1024;

/**
 * Sniffed from the bytes, never from what the client claimed.
 *
 * A content type in the request body is a suggestion; the first few bytes of
 * the file are the fact. Only these two, so nothing we serve back can be an
 * SVG — which is a document that can carry script, not a picture.
 */
const SIGNATURES = [
  { ext: 'jpg', type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'png', type: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
];

function sniff(buffer) {
  return (
    SIGNATURES.find((candidate) =>
      candidate.magic.every((byte, index) => buffer[index] === byte),
    ) ?? null
  );
}

/** Only ever a token and an extension we produced. Nothing from a request. */
const FILE_PATTERN = /^[0-9a-f]{32}\.(jpg|png)$/;

export const isAvatarFile = (file) => typeof file === 'string' && FILE_PATTERN.test(file);

export const contentTypeOf = (file) => (file.endsWith('.png') ? 'image/png' : 'image/jpeg');

export const avatarUrlFor = (file) => (isAvatarFile(file) ? `/api/avatars/${file}` : null);

export function avatarPath(file) {
  if (!isAvatarFile(file)) return null;
  return path.join(config.avatarDir, file);
}

/**
 * Decode, check, write. Returns the new file name.
 *
 * Size is checked after decoding rather than on the base64 string, because
 * base64 inflates by a third and the limit is about bytes on disk.
 */
export async function saveAvatar(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new ValidationError('image', 'No image was sent.');
  }

  // Data URIs arrive from the web picker; strip the prefix rather than
  // making every caller remember to.
  const payload = base64.replace(/^data:image\/[a-z+]+;base64,/, '');
  const buffer = Buffer.from(payload, 'base64');

  if (buffer.length === 0) throw new ValidationError('image', 'That image could not be read.');
  if (buffer.length > MAX_BYTES) {
    throw new ValidationError('image', 'That image is too large. Pick a smaller one.');
  }

  const kind = sniff(buffer);
  if (!kind) throw new ValidationError('image', 'Only JPEG and PNG images are accepted.');

  const file = `${crypto.randomBytes(16).toString('hex')}.${kind.ext}`;
  await fs.mkdir(config.avatarDir, { recursive: true });
  await fs.writeFile(path.join(config.avatarDir, file), buffer);
  return file;
}

/** Best effort: a missing file is already the state we wanted. */
export async function deleteAvatar(file) {
  const full = avatarPath(file);
  if (!full) return;
  await fs.rm(full, { force: true });
}
