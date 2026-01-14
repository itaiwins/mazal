/**
 * Orthodox Tabs Layout
 *
 * Main app navigation for Orthodox users
 * Features: Discover, Shadchan, Matches, Profile
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { useMatchStore } from '@/stores/matchStore';

type TabIconName = 'heart' | 'heart-outline' | 'people' | 'people-outline' | 'chatbubbles' | 'chatbubbles-outline' | 'person' | 'person-outline';

function TabBarIcon({
  name,
  color,
  focused,
  isStarOfDavid,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
  isStarOfDavid?: boolean;
}) {
  if (isStarOfDavid) {
    return (
      <View style={styles.iconContainer}>
        <Text style={[styles.starIcon, { color }]}>✡</Text>
        {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
      </View>
    );
  }

  return (
    <View style={styles.iconContainer}>
      <Ionicons name={name} size={26} color={color} />
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

export default function OrthodoxTabsLayout() {
  const insets = useSafeAreaInsets();
  const unreadMatchesCount = useMatchStore((s) => s.unreadMatchesCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.gold,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarStyle: {
          backgroundColor: '#0a1628',
          borderTopColor: 'rgba(212, 175, 55, 0.2)',
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
        name="shadchan"
        options={{
          title: 'Shadchan',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'people' : 'people-outline'}
              color={color}
              focused={focused}
              isStarOfDavid
            />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              color={color}
              focused={focused}
            />
          ),
          tabBarBadge: unreadMatchesCount > 0 ? unreadMatchesCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary.gold,
            color: colors.primary.navy,
            fontSize: 11,
            fontWeight: '600',
          },
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
  );
}

const styles = StyleSheet.create({
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
  starIcon: {
    fontSize: 24,
  },
});
