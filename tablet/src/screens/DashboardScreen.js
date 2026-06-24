import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function DashboardScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>Workshop Dashboard</Text>

            <View style={styles.grid}>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('NewCTRB')}>
                    <Text style={styles.cardText}>Receive New CTRB</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Inspection')}>
                    <Text style={styles.cardText}>Component Inspections</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Assembly')}>
                    <Text style={styles.cardText}>Submit Assembly</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 32, backgroundColor: '#f1f5f9' },
    header: { fontSize: 32, fontWeight: 'bold', marginBottom: 32, color: '#1e293b' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    card: { backgroundColor: '#ffffff', padding: 32, borderRadius: 12, elevation: 2, minWidth: 200, alignItems: 'center' },
    cardText: { fontSize: 20, fontWeight: '600', color: '#0f172a' }
});
