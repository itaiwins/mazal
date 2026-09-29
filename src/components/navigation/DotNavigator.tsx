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

/**
 * Every measurement that makes up the navigator's height, in one place.
 *
 * MEXA-338 (walkthrough finding 9): the navigator is `position: 'absolute'` over the
 * screen, and the screens beneath only ever padded by `insets.bottom`, so the discover
 * action buttons, the chat composer and the first row of the profile's Account list all
 * sat underneath it. A screen cannot pad correctly for something whose height it has to
 * guess, so the height is derived from these and exported.
 *
 * The two line heights are pinned rather than left to the platform on purpose: an
 * unspecified `lineHeight` makes the total a function of the font metrics, which is
 * exactly the kind of number that is right on this machine and wrong on a device.
 */
const METRICS = {
  paddingTop: spacing[1], // 4
  hintLineHeight: 12,
  hintMarginBottom: spacing[2], // 8
  dotsRowPaddingVertical: spacing[3], // 12
  dotHeight: 6,
  labelMarginTop: spacing[1.5], // 6
  labelLineHeight: 13,
  paddingBottom: 12,
} as const;

/** One dot plus its label. Fixed, so the row does not change height with the active tab. */
const DOT_WRAPPER_HEIGHT =
  METRICS.dotHeight + METRICS.labelMarginTop + METRICS.labelLineHeight;

/**
 * How much of the bottom of the screen the navigator covers, **excluding** the safe-area
 * inset it adds on top. Summed from `METRICS` rather than written out, so it cannot drift
 * from the stylesheet below.
 *
 * Prefer `useDotNavigatorInset()` — a screen wants this plus the real inset.
 */
export const DOT_NAVIGATOR_HEIGHT =
  METRICS.paddingTop +
  METRICS.hintLineHeight +
  METRICS.hintMarginBottom +
  METRICS.dotsRowPaddingVertical * 2 +
  DOT_WRAPPER_HEIGHT +
  METRICS.paddingBottom;

/**
 * The bottom padding a screen under the navigator needs to keep its own content clear of
 * it. Add whatever breathing room the screen wants on top.
 *
 * Reads the live insets, so it is correct on a device without this file knowing anything
 * about which device — the walkthrough render's inset is 0 and a notched iPhone's is 34.
 */
export function useDotNavigatorInset(): number {
  const insets = useSafeAreaInsets();
  return DOT_NAVIGATOR_HEIGHT + insets.bottom;
}

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
        {/*
          Ternary, not `&&`: `badge` is a number, so `badge && …` returns 0 when the count is
          0 and React renders that 0 as a bare text child of this View, which react-native
          treats as an invariant violation ("Text strings must be rendered within a <Text>
          component"). That is every user with nothing unread (MEXA-336).
        */}
        {badge !== undefined && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
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
    <View
      style={[styles.container, { paddingBottom: insets.bottom + METRICS.paddingBottom }]}
    >
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
    paddingTop: METRICS.paddingTop,
  },
  hintContainer: {
    marginBottom: METRICS.hintMarginBottom,
    opacity: 0.3,
  },
  hintText: {
    fontSize: 10,
    lineHeight: METRICS.hintLineHeight,
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing[5],
    paddingVertical: METRICS.dotsRowPaddingVertical,
    paddingHorizontal: spacing[6],
  },
  dotWrapper: {
    alignItems: 'center',
    minWidth: 44,
    height: DOT_WRAPPER_HEIGHT,
  },
  dotContainer: {
    position: 'relative',
    height: METRICS.dotHeight,
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
    lineHeight: METRICS.labelLineHeight,
    fontWeight: '500',
    color: colors.transparent.white60,
    marginTop: METRICS.labelMarginTop,
  },
});
