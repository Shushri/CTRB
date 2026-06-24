import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AssemblyScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>Assembly Tracking & QC</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 32, backgroundColor: '#f1f5f9' },
    header: { fontSize: 32, fontWeight: 'bold' }
});
