import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ViewStyle, Alert, Platform } from 'react-native';
import { theme } from '../../theme';

interface ListItemProps {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    placeholderIcon?: string;
    onPress?: () => void;
    trailing?: React.ReactNode;
    style?: ViewStyle;
    onPlayPress?: () => void;
    canPlay?: boolean;
}

export function ListItem({
    title,
    subtitle,
    imageUrl,
    placeholderIcon = '*',
    onPress,
    trailing,
    style,
    onPlayPress,
    canPlay,
}: ListItemProps) {
    const notify = (msg: string) => {
        if (Platform.OS === 'web' && typeof (globalThis as any).alert === 'function') {
            (globalThis as any).alert(msg);
            return;
        }
        Alert.alert(msg);
    };
    const isPlayable = onPlayPress ? (canPlay !== undefined ? canPlay : true) : false;
    const content = (
        <View style={[styles.container, style]}>
            {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.thumb} />
            ) : (
                <View style={styles.thumbPlaceholder}>
                    <Text style={styles.thumbText}>{placeholderIcon}</Text>
                </View>
            )}
            <View style={styles.texts}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View style={styles.trailing}>
                {onPlayPress && isPlayable ? (
                    <Pressable
                        onPress={(e: any) => {
                            if (e?.stopPropagation) e.stopPropagation();
                            if (isPlayable) {
                                onPlayPress();
                            } else {
                                notify('No preview available');
                            }
                        }}
                        hitSlop={12}
                        style={[styles.playBtn, !isPlayable && styles.playBtnDisabled]}
                    >
                        <Text style={[styles.playText, !isPlayable && styles.playTextDisabled]}>▶</Text>
                    </Pressable>
                ) : null}
                {trailing}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
                {content}
            </Pressable>
        );
    }
    return content;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    thumb: {
        width: 50,
        height: 50,
        borderRadius: theme.radius.sm,
        marginRight: theme.spacing(3),
    },
    thumbPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: theme.radius.sm,
        marginRight: theme.spacing(3),
        backgroundColor: theme.colors.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbText: {
        color: theme.colors.accent,
        fontWeight: '700',
    },
    texts: {
        flex: 1,
    },
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(2),
    },
    pressed: {
        opacity: 0.8,
    },
    title: {
        color: theme.colors.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    subtitle: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        marginTop: 2,
    },
    playBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing(2),
        zIndex: 2,
    },
    playBtnDisabled: {
        backgroundColor: theme.colors.surfaceSubtle,
    },
    playText: {
        color: theme.colors.accentText,
        fontWeight: '800',
    },
    playTextDisabled: {
        color: theme.colors.textSecondary,
    },
});
