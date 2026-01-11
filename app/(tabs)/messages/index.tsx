/**
 * Messages Index
 *
 * Redirects to matches screen (conversations are shown there)
 */

import { Redirect } from 'expo-router';

export default function MessagesIndex() {
  return <Redirect href="/(tabs)/matches" />;
}
