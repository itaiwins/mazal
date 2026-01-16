/**
 * Minimal Dot Navigator with Drag Support
 *
 * Clean dot indicators + drag on dots row to navigate
 */

import { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// Threshold for drag navigation
const DRAG_THRESHOLD = 40;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 180,
};

interface TabItem {
  name: string;
  label: string;
  badge?: number;
}

interface DotNavigatorProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

function Dot({
  isActive,
  label,
  badge,
}: {
  isActive: boolean;
  label: string;
  badge?: number;
}) {
  const dotStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 28 : 6, SPRING_CONFIG),
    height: 6,
    opacity: withSpring(isActive ? 1 : 0.4, SPRING_CONFIG),
  }));

  return (
    <View style={styles.dotWrapper}>
      <View style={styles.dotContainer}>
        <Animated.View style={[styles.dot, dotStyle]} />
        {badge && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      {isActive && (
        <Text style={styles.label}>{label}</Text>
      )}
    </View>
  );
}

export function DotNavigator({ tabs, activeTab, onTabPress }: DotNavigatorProps) {
  const insets = useSafeAreaInsets();
  const activeIndex = tabs.findIndex(t => t.name === activeTab);
  const lastNavigateTime = useRef(0);
  const cumulativeX = useSharedValue(0);

  const navigateToIndex = useCallback((index: number) => {
    // Throttle navigation
    const now = Date.now();
    if (now - lastNavigateTime.current < 250) return;
    lastNavigateTime.current = now;

    if (index >= 0 && index < tabs.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabPress(tabs[index].name);
    }
  }, [tabs, onTabPress]);

  const handleTap = useCallback((tabName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabPress(tabName);
  }, [onTabPress]);

  // Pan gesture for dragging between tabs
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      cumulativeX.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      const deltaX = event.translationX - cumulativeX.value;

      // Check if we've moved enough to trigger navigation
      if (Math.abs(event.translationX) > DRAG_THRESHOLD) {
        cumulativeX.value = event.translationX;

        if (event.translationX > 0 && activeIndex > 0) {
          // Dragged right - go to previous tab
          runOnJS(navigateToIndex)(activeIndex - 1);
        } else if (event.translationX < 0 && activeIndex < tabs.length - 1) {
          // Dragged left - go to next tab
          runOnJS(navigateToIndex)(activeIndex + 1);
        }
      }
    });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>Drag dots to navigate</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View style={styles.dotsRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.name}
              onPress={() => handleTap(tab.name)}
              hitSlop={16}
            >
              <Dot
                isActive={tab.name === activeTab}
                label={tab.label}
                badge={tab.badge}
              />
            </Pressable>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing[1],
  },
  hintContainer: {
    marginBottom: spacing[2],
    opacity: 0.3,
  },
  hintText: {
    fontSize: 10,
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing[5],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  dotWrapper: {
    alignItems: 'center',
    minWidth: 44,
  },
  dotContainer: {
    position: 'relative',
    height: 6,
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: colors.primary.gold,
    borderRadius: 3,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.semantic.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary.white,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.transparent.white60,
    marginTop: spacing[1.5],
  },
});
