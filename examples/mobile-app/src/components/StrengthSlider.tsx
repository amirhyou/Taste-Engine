import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

interface StrengthSliderProps {
    onVote: (strength: number) => void;
    disabled?: boolean;
}

export const StrengthSlider: React.FC<StrengthSliderProps> = ({ onVote, disabled }) => {
    const [value, setValue] = React.useState(0);

    const handleValueChange = (val: number) => {
        // If crossing the center point (0.0), provide haptic feedback
        if ((value < 0 && val >= 0) || (value > 0 && val <= 0)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setValue(val);
    };

    const handleSlidingComplete = (val: number) => {
        onVote(val);
        setValue(0); // Reset for next pair
    };

    return (
        <View style={styles.container}>
            <Slider
                style={styles.slider}
                minimumValue={-1}
                maximumValue={1}
                value={value}
                onValueChange={handleValueChange}
                onSlidingComplete={handleSlidingComplete}
                minimumTrackTintColor="#1DB954"
                maximumTrackTintColor="#1DB954"
                thumbTintColor="#FFFFFF"
                disabled={disabled}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        marginVertical: 20,
    },
    slider: {
        width: '100%',
        height: 40,
    },
});
