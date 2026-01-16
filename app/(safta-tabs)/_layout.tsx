/**
 * Safta Tabs Layout
 *
 * Minimal dot navigation for grandparent matchmaking mode
 */

import { useCallback } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { DotNavigator } from '@/components/navigation/DotNavigator';

// Define Safta tabs
const SAFTA_TABS = [
  { name: 'index', label: 'Discover' },
  { name: 'messages', label: 'Messages' },
  { name: 'profile', label: 'Profile' },
];

export default function SaftaTabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname === '/(safta-tabs)' || pathname === '/(safta-tabs)/index') {
      return 'index';
    }
    const segments = pathname.split('/').filter(Boolean);
    const tabSegment = segments.find(s => !s.startsWith('('));
    return tabSegment || 'index';
  };

  const activeTab = getActiveTab();

  const handleTabPress = useCallback((tabName: string) => {
    if (tabName === 'index') {
      router.push('/(safta-tabs)/');
    } else {
      router.push(`/(safta-tabs)/${tabName}` as any);
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
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <DotNavigator
        tabs={SAFTA_TABS}
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
