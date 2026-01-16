/**
 * Orthodox Shadchan Screen
 *
 * Connect with verified matchmakers in the Orthodox community
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface Shadchan {
  id: string;
  display_name: string;
  bio: string;
  photo_url: string | null;
  years_experience: number;
  successful_matches: number;
  is_verified: boolean;
}

function ShadchanCard({ shadchan, onConnect }: { shadchan: Shadchan; onConnect: () => void }) {
  return (
    <Animated.View entering={FadeInUp.springify()} style={styles.shadchanCard}>
      <View style={styles.shadchanHeader}>
        {shadchan.photo_url ? (
          <Image source={{ uri: shadchan.photo_url }} style={styles.shadchanPhoto} />
        ) : (
          <View style={styles.shadchanPhotoPlaceholder}>
            <Ionicons name="person" size={32} color={colors.neutral[400]} />
          </View>
        )}
        <View style={styles.shadchanInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.shadchanName}>{shadchan.display_name}</Text>
            {shadchan.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.semantic.info} />
              </View>
            )}
          </View>
          <Text style={styles.shadchanStats}>
            {shadchan.years_experience} years experience
          </Text>
          <Text style={styles.shadchanMatches}>
            {shadchan.successful_matches} successful matches
          </Text>
        </View>
      </View>

      {shadchan.bio && (
        <Text style={styles.shadchanBio} numberOfLines={2}>
          {shadchan.bio}
        </Text>
      )}

      <Pressable style={styles.connectButton} onPress={onConnect}>
        <LinearGradient
          colors={[colors.primary.gold, '#e6c358']}
          style={styles.connectButtonGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        >
          <Text style={styles.connectButtonText}>Connect</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary.navy} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function ShadchanScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [shadchanim, setShadchanim] = useState<Shadchan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connections, setConnections] = useState<string[]>([]);

  useEffect(() => {
    const fetchShadchanim = async () => {
      try {
        // Fetch active shadchanim
        // Note: shadchanim table created via migration
        const { data, error } = await (supabase as any)
          .from('shadchanim')
          .select('*')
          .eq('is_active', true)
          .order('successful_matches', { ascending: false });

        if (error) throw error;
        setShadchanim(data || []);

        // Fetch user's existing connections
        // Note: shadchan_connections table created via migration
        if (user?.id) {
          const { data: connectionData } = await (supabase as any)
            .from('shadchan_connections')
            .select('shadchan_id')
            .eq('user_id', user.id);

          setConnections(connectionData?.map((c: any) => c.shadchan_id) || []);
        }
      } catch (error) {
        console.error('Error fetching shadchanim:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShadchanim();
  }, [user?.id]);

  const handleConnect = async (shadchanId: string) => {
    if (!user?.id) return;

    try {
      // Note: shadchan_connections table created via migration
      const { error } = await (supabase as any).from('shadchan_connections').insert({
        user_id: user.id,
        shadchan_id: shadchanId,
        status: 'pending',
      });

      if (!error) {
        setConnections([...connections, shadchanId]);
      }
    } catch (error) {
      console.error('Error connecting to shadchan:', error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.starOfDavid}>✡</Text>
          <View>
            <Text style={styles.hebrewTitle}>שדכנים</Text>
            <Text style={styles.title}>Shadchan Connect</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionTitle}>Find Your Shadchan</Text>
          <Text style={styles.descriptionText}>
            Connect with experienced matchmakers who understand the Orthodox community and can help guide you to find your bashert.
          </Text>
        </View>

        {/* Shadchanim List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.gold} />
          </View>
        ) : shadchanim.length > 0 ? (
          <View style={styles.shadchanList}>
            {shadchanim.map((shadchan) => (
              <ShadchanCard
                key={shadchan.id}
                shadchan={shadchan}
                onConnect={() => handleConnect(shadchan.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✡</Text>
            <Text style={styles.emptyStateTitle}>Coming Soon</Text>
            <Text style={styles.emptyStateText}>
              We're working on connecting you with verified shadchanim in your community.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  starOfDavid: {
    fontSize: 40,
    color: colors.primary.gold,
  },
  hebrewTitle: {
    fontSize: 20,
    color: colors.primary.gold,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  descriptionCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    marginBottom: spacing[6],
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  descriptionText: {
    fontSize: 14,
    color: colors.transparent.white70,
    lineHeight: 22,
  },
  loadingContainer: {
    paddingVertical: spacing[8],
    alignItems: 'center',
  },
  shadchanList: {
    gap: spacing[4],
  },
  shadchanCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    gap: spacing[3],
  },
  shadchanHeader: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  shadchanPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  shadchanPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadchanInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  shadchanName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  verifiedBadge: {
    marginLeft: spacing[1],
  },
  shadchanStats: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: 2,
  },
  shadchanMatches: {
    fontSize: 13,
    color: colors.primary.gold,
  },
  shadchanBio: {
    fontSize: 14,
    color: colors.transparent.white70,
    lineHeight: 20,
  },
  connectButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyStateIcon: {
    fontSize: 48,
    color: colors.primary.gold,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.transparent.white60,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
});
