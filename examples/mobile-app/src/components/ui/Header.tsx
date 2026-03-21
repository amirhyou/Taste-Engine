import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface HeaderProps {
    title: string;
    leftIcon?: React.ReactNode;
    onLeftPress?: () => void;
    right?: React.ReactNode;
}

export function Header({ title, leftIcon, onLeftPress, right }: HeaderProps) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.side}>
                {leftIcon ? (
                    <TouchableOpacity onPress={onLeftPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {leftIcon}
                    </TouchableOpacity>
                ) : null}
            </View>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.side}>{right}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing(4),
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(2),
    },
    side: { minWidth: 32, alignItems: 'flex-start' },
    title: {
        ...theme.typography.title,
        fontSize: 20,
        textAlign: 'center',
    },
});
