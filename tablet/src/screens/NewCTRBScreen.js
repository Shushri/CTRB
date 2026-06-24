import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { database } from '../database';

export default function NewCTRBScreen({ navigation }) {
    const [ctrbNumber, setCtrbNumber] = useState('');
    const [make, setMake] = useState('timken');

    const handleSave = async () => {
        if (!ctrbNumber) {
            Alert.alert('Error', 'CTRB Number is required');
            return;
        }

        try {
            await database.write(async () => {
                await database.collections.get('ctrb_records').create(record => {
                    record.ctrb_number = ctrbNumber;
                    record.job_id = `JOB-${Date.now()}`;
                    record.make = make;
                    record.date_received = new Date().toISOString();
                    record.status = 'received';
                });
            });
            Alert.alert('Success', 'Record Saved to Offline Database', [
                { text: 'OK', onPress: () => navigation.navigate('Dashboard') }
            ]);
        } catch (err) {
            Alert.alert('Error', 'Failed to save to database');
            console.error(err);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Receive New CTRB</Text>
            <TextInput style={styles.input} placeholder="12-digit CTRB Number" value={ctrbNumber} onChangeText={setCtrbNumber} />
            <TextInput style={styles.input} placeholder="Make (timken, fag, etc)" value={make} onChangeText={setMake} />
            <TouchableOpacity style={styles.button} onPress={handleSave}>
                <Text style={styles.buttonText}>Save Initial Record</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 32, backgroundColor: '#f1f5f9' },
    header: { fontSize: 32, fontWeight: 'bold', marginBottom: 24 },
    input: { backgroundColor: '#fff', padding: 16, marginBottom: 16, borderRadius: 8, fontSize: 18 },
    button: { backgroundColor: '#3b82f6', padding: 20, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});

