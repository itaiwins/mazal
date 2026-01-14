/**
 * Shabbat Mode Screen
 *
 * Displayed when the app is in Shabbat mode (paused during Shabbat/Yom Tov)
 */

import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFormattedZmanim } from '@/services/shabbatService';

const { width, height } = Dimensions.get('window');

// Candle flame component
function CandleFlame({ delay }: { delay: number }) {
  const flicker = useSharedValue(1);
  const sway = useSharedValue(0);

  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    sway.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1000 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(-5, { duration: 1000 + delay, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flicker.value }, { rotate: `${sway.value}deg` }],
    opacity: 0.8 + flicker.value * 0.2,
  }));

  return (
    <Animated.View style={[styles.candleContainer, { marginLeft: delay > 0 ? 40 : 0 }]}>
      <Animated.View style={[styles.flame, flameStyle]}>
        <View style={styles.flameInner} />
        <View style={styles.flameOuter} />
      </Animated.View>
      <View style={styles.candle}>
        <View style={styles.wick} />
      </View>
    </Animated.View>
  );
}

interface ShabbatModeScreenProps {
  message?: string;
}

export default function ShabbatModeScreen({ message }: ShabbatModeScreenProps) {
  const insets = useSafeAreaInsets();
  const zmanim = useFormattedZmanim();

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0d1e35']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Stars background */}
      {Array.from({ length: 20 }).map((_, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(i * 100)}
          style={[
            styles.star,
            {
              left: Math.random() * width,
              top: Math.random() * height * 0.5,
              opacity: 0.3 + Math.random() * 0.7,
            },
          ]}
        >
          <Text style={styles.starText}>✦</Text>
        </Animated.View>
      ))}

      {/* Candles */}
      <Animated.View entering={FadeIn.delay(500)} style={styles.candlesRow}>
        <CandleFlame delay={0} />
        <CandleFlame delay={300} />
      </Animated.View>

      {/* Main Content */}
      <View style={styles.content}>
        <Animated.Text entering={FadeInDown.delay(700)} style={styles.hebrewGreeting}>
          שבת שלום
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(800)} style={styles.title}>
          Shabbat Shalom
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(900)} style={styles.subtitle}>
          The app is resting for Shabbat
        </Animated.Text>

        {/* Zmanim Info */}
        {zmanim && (
          <Animated.View entering={FadeInDown.delay(1000)} style={styles.zmanimContainer}>
            <View style={styles.zmanimBox}>
              <View style={styles.zmanimItem}>
                <View style={styles.zmanimIcon}>
                  <Ionicons name="sunny-outline" size={18} color="#d4af37" />
                </View>
                <View>
                  <Text style={styles.zmanimLabel}>Candle Lighting</Text>
                  <Text style={styles.zmanimTime}>{zmanim.candleLighting}</Text>
                </View>
              </View>

              <View style={styles.zmanimDivider} />

              <View style={styles.zmanimItem}>
                <View style={styles.zmanimIcon}>
                  <Ionicons name="moon-outline" size={18} color="#d4af37" />
                </View>
                <View>
                  <Text style={styles.zmanimLabel}>Havdalah</Text>
                  <Text style={styles.zmanimTime}>{zmanim.havdalah}</Text>
                </View>
              </View>
            </View>

            {zmanim.city && (
              <Text style={styles.locationText}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.4)" />
                {' '}{zmanim.city}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Message */}
        <Animated.View entering={FadeInDown.delay(1100)} style={styles.messageBox}>
          <Text style={styles.messageText}>
            {message || 'May this Shabbat bring you peace, rest, and connection. The app will automatically resume after Havdalah.'}
          </Text>
        </Animated.View>

        {/* Quote */}
        <Animated.View entering={FadeInDown.delay(1200)} style={styles.quoteContainer}>
          <Text style={styles.quoteText}>
            "More than Israel has kept the Shabbat, the Shabbat has kept Israel"
          </Text>
          <Text style={styles.quoteSource}>— Ahad Ha'am</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
  },
  starText: {
    fontSize: 8,
    color: '#d4af37',
  },
  candlesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  candleContainer: {
    alignItems: 'center',
  },
  flame: {
    width: 20,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flameOuter: {
    position: 'absolute',
    width: 18,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#ff9500',
    bottom: 0,
    opacity: 0.6,
  },
  flameInner: {
    position: 'absolute',
    width: 10,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#ffcc00',
    bottom: 4,
    opacity: 0.9,
  },
  candle: {
    width: 16,
    height: 60,
    backgroundColor: '#f5f0e6',
    borderRadius: 2,
    alignItems: 'center',
  },
  wick: {
    width: 2,
    height: 8,
    backgroundColor: '#333',
    position: 'absolute',
    top: -4,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  hebrewGreeting: {
    fontSize: 48,
    color: '#d4af37',
    marginBottom: 8,
    textShadowColor: '#d4af37',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 30,
  },
  zmanimContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  zmanimBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  zmanimItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zmanimIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zmanimLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  zmanimTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  zmanimDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    marginHorizontal: 20,
  },
  locationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
  },
  messageBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 30,
    maxWidth: 340,
  },
  messageText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  quoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 4,
  },
  quoteSource: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});
