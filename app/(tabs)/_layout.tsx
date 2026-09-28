/**
 * Tabs Layout
 *
 * Minimal dot navigation - clean and unobtrusive
 */

import { useCallback } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { useMatchStore } from '@/stores/matchStore';
import { DotNavigator } from '@/components/navigation/DotNavigator';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';

// Define visible tabs. The Safta tab is hidden behind a flag (docs/ROADMAP.md)
const TABS = [
  { name: 'index', label: 'Discover' },
  { name: 'mazal-map', label: 'Map' },
  { name: 'matches', label: 'Matches' },
  ...(FEATURE_SAFTA_MODE ? [{ name: 'safta', label: 'Safta' }] : []),
  { name: 'profile', label: 'Profile' },
];

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const unreadMatchesCount = useMatchStore((s) => s.unreadMatchesCount);

  // Determine active tab from pathname
  const getActiveTab = () => {
    if (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index') {
      return 'index';
    }
    const segments = pathname.split('/').filter(Boolean);
    const tabSegment = segments.find(s => !s.startsWith('('));
    return tabSegment || 'index';
  };

  const activeTab = getActiveTab();

  // Add badges to tabs
  const tabsWithBadges = TABS.map(tab => ({
    ...tab,
    badge: tab.name === 'matches' ? unreadMatchesCount : undefined,
  }));

  const handleTabPress = useCallback((tabName: string) => {
    if (tabName === 'index') {
      router.push('/(tabs)/');
    } else {
      router.push(`/(tabs)/${tabName}` as any);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="mazal-map" />
        <Tabs.Screen name="matches" />
        <Tabs.Screen name="safta" options={FEATURE_SAFTA_MODE ? undefined : { href: null }} />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="safta-chat/[connectionId]" options={{ href: null }} />
      </Tabs>

      {/* Minimal Dot Navigator */}
      <DotNavigator
        tabs={tabsWithBadges}
        activeTab={activeTab}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
});
