import React from "react";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

/**
 * The app's single icon set (Material Community Icons). Icons are decorative and hidden from
 * screen readers unless a label is given; critical states always pair the icon with text.
 */
export function Icon({ name, size = 20, color, label }: { name: string; size?: number; color: string; label?: string }) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessible={!!label}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    />
  );
}
