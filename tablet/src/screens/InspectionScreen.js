import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function InspectionScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>Visual & Dimensional Inspections</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 32, backgroundColor: '#f1f5f9' },
    header: { fontSize: 32, fontWeight: 'bold' }
});
