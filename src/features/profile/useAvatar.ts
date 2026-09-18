import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { avatarsApi } from '../../api/avatars';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../ui/Toast';

/**
 * Your profile picture: choose one, or drop it.
 *
 * Everything awkward about pictures is in here so no screen has to know about
 * it — permissions, cancelling, the size ceiling, the OS crop.
 *
 * On the size: the picker is asked for a square at 0.55 quality, which puts a
 * phone camera photo comfortably under the server's 400 KB limit without a
 * second library to resize with. It is a ceiling that can be missed — a very
 * large panorama cropped square can still come back big — so the server
 * refuses rather than trusts, and the message it sends is what the user sees.
 */
export function useAvatar() {
  const { token } = useAuth();
  const { notify } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    void avatarsApi.mine(token).then((result) => {
      if (mounted.current && result.ok) setAvatarUrl(result.data.avatarUrl);
    });
  }, [token]);

  const choose = useCallback(async () => {
    if (!token || busy) return;

    /*
     * Asked for only at the moment somebody taps "change picture".
     *
     * Requesting library access at launch, before there is any reason for it,
     * is how an app trains people to refuse the prompt. Denial is a normal
     * answer here and not an error: the app simply keeps their initials.
     */
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('No access to your photos. Your initials stay as they are.', 'info');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });

    // Backing out of the picker is not a failure and says nothing.
    if (picked.canceled) return;

    const image = picked.assets?.[0]?.base64;
    if (!image) {
      notify('That image could not be read.', 'error');
      return;
    }

    setBusy(true);
    const result = await avatarsApi.upload(token, image);
    if (!mounted.current) return;
    setBusy(false);

    if (!result.ok) {
      notify(result.error.message, 'error');
      return;
    }
    setAvatarUrl(result.data.avatarUrl);
    notify('Picture updated.', 'success');
  }, [busy, notify, token]);

  const remove = useCallback(async () => {
    if (!token || busy || !avatarUrl) return;
    setBusy(true);
    const result = await avatarsApi.remove(token);
    if (!mounted.current) return;
    setBusy(false);

    if (!result.ok) {
      notify(result.error.message, 'error');
      return;
    }
    setAvatarUrl(null);
    notify('Back to your initials.', 'info');
  }, [avatarUrl, busy, notify, token]);

  return { avatarUrl, busy, choose, remove };
}
