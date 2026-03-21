import React from 'react';
import { Text, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface BadgeProps {
    label: string;
    tone?: 'default' | 'success';
    style?: ViewStyle;
}

export function Badge({ label, tone = 'default', style }: BadgeProps) {
    const isSuccess = tone === 'success';
    return (
        <View style={[styles.base, isSuccess ? styles.success : styles.default, style]}>
            <Text style={isSuccess ? styles.successText : styles.defaultText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingHorizontal: theme.spacing(2),
        paddingVertical: theme.spacing(1),
        borderRadius: theme.radius.sm,
        alignSelf: 'flex-start',
    },
    default: {
        backgroundColor: theme.colors.surfaceSubtle,
    },
    defaultText: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    success: {
        backgroundColor: '#163f2a',
    },
    successText: {
        color: theme.colors.accent,
        fontSize: 11,
        fontWeight: '700',
    },
});
