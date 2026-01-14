/**
 * Safta Tabs Layout
 *
 * Tab navigator for grandparent matchmaking mode
 * Three tabs: Discover, Messages, Profile
 * Uses same design as regular user mode with "Safta Mode" indicator
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type TabIconName = 'heart' | 'heart-outline' | 'chatbubbles' | 'chatbubbles-outline' | 'person' | 'person-outline';

function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons name={name} size={26} color={color} />
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

export default function SaftaTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary.gold,
          tabBarInactiveTintColor: colors.transparent.white50,
          tabBarStyle: {
            backgroundColor: colors.dark.card,
            borderTopColor: colors.neutral[800],
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'heart' : 'heart-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'person' : 'person-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});
