/**
 * useAuthLink
 *
 * Resolves the auth params of the deep link that brought the user to the current
 * screen.
 *
 * Two sources, because neither alone is reliable:
 *  - `Linking.useURL()` gives the raw URL including the `#fragment`, which is
 *    where the implicit flow puts the tokens. React Navigation strips the
 *    fragment before expo-router sees it, so this is the only way to read them.
 *  - `useLocalSearchParams()` covers query-param links (PKCE `?code=...`, or a
 *    manually constructed link), and works when the app was already open.
 *
 * `Linking.useURL()` starts as `null` and stays `null` when the app was not
 * opened by a link at all, so `resolved` only flips to `true` once a link is
 * found or a short grace period has passed. Without that, a cold start would
 * flash the "invalid link" state for a frame before the URL arrives.
 */

import { useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { parseAuthLink, parseAuthLinkParams, type AuthLinkParams } from './authDeepLink';

/** How long to wait for `getInitialURL()` before giving up on the link. */
const LINK_GRACE_PERIOD_MS = 3000;

export function useAuthLink(): { link: AuthLinkParams | null; resolved: boolean } {
  const url = Linking.useURL();
  const params = useLocalSearchParams();
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGraceExpired(true), LINK_GRACE_PERIOD_MS);
    return () => clearTimeout(timer);
  }, []);

  // `useLocalSearchParams()` hands back a fresh object on every render, so key the
  // memo off its serialised contents. Otherwise `link` would get a new identity
  // each render and re-trigger the caller's effect forever.
  const paramsKey = JSON.stringify(params ?? {});

  const link = useMemo(
    () =>
      parseAuthLink(url) ??
      parseAuthLinkParams(JSON.parse(paramsKey) as Record<string, unknown>),
    [url, paramsKey]
  );

  return { link, resolved: link !== null || graceExpired };
}
