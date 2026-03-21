import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface ButtonProps {
    label: string;
    onPress: () => void;
    kind?: 'primary' | 'secondary';
    style?: ViewStyle;
}

export function Button({ label, onPress, kind = 'primary', style }: ButtonProps) {
    const isPrimary = kind === 'primary';
    return (
        <TouchableOpacity onPress={onPress} style={[styles.base, isPrimary ? styles.primary : styles.secondary, style]}>
            <Text style={isPrimary ? styles.primaryText : styles.secondaryText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primary: {
        backgroundColor: theme.colors.accent,
    },
    secondary: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'transparent',
    },
    primaryText: {
        color: theme.colors.accentText,
        fontWeight: '700',
        fontSize: 14,
    },
    secondaryText: {
        color: theme.colors.textPrimary,
        fontWeight: '700',
        fontSize: 14,
    },
});
