import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function LoginScreen({ navigation }) {
    const [personnelId, setPersonnelId] = useState('');
    const [pin, setPin] = useState('');

    const handleLogin = () => {
        // Mock login
        navigation.navigate('Dashboard');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>CTRB-TIMS Login</Text>
            <TextInput style={styles.input} placeholder="Personnel ID" value={personnelId} onChangeText={setPersonnelId} />
            <TextInput style={styles.input} placeholder="PIN" value={pin} onChangeText={setPin} secureTextEntry />
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#f1f5f9' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
    input: { backgroundColor: '#fff', padding: 16, marginBottom: 16, borderRadius: 8, fontSize: 18 },
    button: { backgroundColor: '#3b82f6', padding: 20, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});
