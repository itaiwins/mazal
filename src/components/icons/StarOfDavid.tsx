/**
 * Star of David Icon Component
 *
 * Uses MaterialCommunityIcons star-david icon
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StarOfDavidProps {
  size?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
}

export function StarOfDavid({
  size = 24,
  color = '#D4AF37',
  filled = false,
}: StarOfDavidProps) {
  return (
    <MaterialCommunityIcons
      name="star-david"
      size={size}
      color={color}
    />
  );
}

export default StarOfDavid;
