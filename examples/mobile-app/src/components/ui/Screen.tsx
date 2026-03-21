import React from 'react';
import { View, StyleSheet, SafeAreaView, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface ScreenProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export function Screen({ children, style }: ScreenProps) {
    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.container, style]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
});
