import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';

export default function LoginScreen({ navigation }) {
    const [personnelId, setPersonnelId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [isOffline, setIsOffline] = useState(false);
    const pulseAnim = React.useRef(new Animated.Value(0.4)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ])
        ).start();

        const checkConnection = async () => {
            try {
                await apiClient.post('/auth/login', {}, { timeout: 3000 });
            } catch (err) {
                if (err.code === 'ERR_NETWORK' || !err.response) {
                    setIsOffline(true);
                }
            }
        };
        checkConnection();

        const seedCredentialStore = async () => {
            try {
                const check = await AsyncStorage.getItem('users_store');
                if (!check) {
                    const mockCredentials = {
                        'admin101': { name: 'System Administrator', role: 'admin', pin: '1234', id: 'mock-id-admin101' },
                        'op201': { name: 'Data Entry Operator', role: 'operator', pin: '1234', id: 'mock-id-op201' },
                        'qc301': { name: 'Quality Inspector', role: 'inspector', pin: '1234', id: 'mock-id-qc301' }
                    };
                    await AsyncStorage.setItem('users_store', JSON.stringify(mockCredentials));
                    console.log('Seeded local credential store.');
                }
            } catch (err) {
                console.error('Failed to seed credential store:', err);
            }
        };
        seedCredentialStore();
    }, [pulseAnim]);

    const handleLogin = async () => {
        if (!personnelId || !pin) {
            Alert.alert('Validation Error', 'Please fill in both Personnel ID and PIN.');
            return;
        }

        setLoading(true);
        try {
            try {
                // Attempt to authenticate with the backend
            const response = await apiClient.post('/auth/login', {
                personnel_id: personnelId,
                pin: pin
            });

            if (response.data?.data?.token) {
                const { token, user } = response.data.data;
                await AsyncStorage.setItem('userToken', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));
                
                Alert.alert('Success', `Logged in as ${user.name}`);
                navigation.navigate('Dashboard');
            } else {
                throw new Error('Invalid server response structure');
            }
        } catch (err) {
            console.log('API login failed, checking offline fallback...', err.message);

            // Fallback: Check if credentials match local mock users from testing when backend is unreachable
            const storeStr = await AsyncStorage.getItem('users_store');
            const validMocks = storeStr ? JSON.parse(storeStr) : {
                'admin101': { name: 'System Administrator', role: 'admin', pin: '1234', id: 'mock-id-admin101' },
                'op201': { name: 'Data Entry Operator', role: 'operator', pin: '1234', id: 'mock-id-op201' },
                'qc301': { name: 'Quality Inspector', role: 'inspector', pin: '1234', id: 'mock-id-qc301' }
            };

            const localUser = validMocks[personnelId];
            if (localUser && pin === localUser.pin) {
                const mockUser = {
                    id: localUser.id || `mock-id-${personnelId}`,
                    personnel_id: personnelId,
                    name: localUser.name,
                    role: localUser.role
                };
                
                // Store mock session info
                await AsyncStorage.setItem('userToken', 'mock-offline-token');
                await AsyncStorage.setItem('user', JSON.stringify(mockUser));
                
                Alert.alert(
                    'Offline Mode',
                    `Server unreachable. Logged in locally as ${mockUser.name}.`
                );
                navigation.navigate('Dashboard');
            } else {
                const errMsg = err.response?.data?.error || 'Invalid credentials or connection issue.';
                Alert.alert('Login Failed', errMsg);
            }
        }
    } catch (globalErr) {
            Alert.alert('System Error', 'An unexpected error occurred.');
            console.error(globalErr);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafd' }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                    <View style={styles.brandingHeader}>
                        <MaterialCommunityIcons name="train" size={48} color="#ffb55c" />
                        <Text style={styles.railwayText}>INDIAN RAILWAYS</Text>
                        <Text style={styles.systemTitle}>CTRB Traceability & Info Management System</Text>
                    </View>

                    <View style={styles.card}>
                        <Animated.View style={[styles.accentBorder, { opacity: pulseAnim }]} />
                    <Text style={styles.title}>Secure Personnel Login</Text>
                    
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>PERSONNEL ID</Text>
                        <View style={[
                            styles.inputWrapper, 
                            focusedInput === 'personnelId' && styles.inputWrapperFocused
                        ]}>
                            <MaterialCommunityIcons name="account" size={22} color={focusedInput === 'personnelId' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. op201 or admin101" 
                                placeholderTextColor="#94a3b8"
                                value={personnelId} 
                                onChangeText={setPersonnelId} 
                                autoCapitalize="none"
                                autoCorrect={false}
                                onFocus={() => setFocusedInput('personnelId')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>PIN NUMBER</Text>
                        <View style={[
                            styles.inputWrapper, 
                            focusedInput === 'pin' && styles.inputWrapperFocused
                        ]}>
                            <MaterialCommunityIcons name="lock" size={22} color={focusedInput === 'pin' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} 
                                placeholder="Enter 4-digit PIN" 
                                placeholderTextColor="#94a3b8"
                                value={pin} 
                                onChangeText={setPin} 
                                secureTextEntry 
                                keyboardType="numeric"
                                onFocus={() => setFocusedInput('pin')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.button, loading && styles.buttonDisabled]} 
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonText}>Authenticate Securely</Text>
                                <MaterialCommunityIcons name="arrow-right" size={20} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                    {/* Offline Chip */}
                    {isOffline && (
                        <View style={styles.offlineChip}>
                            <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#d97706" />
                            <Text style={styles.offlineChipText}>OFFLINE MODE ACTIVE — LOCAL VERIFICATION ENFORCED</Text>
                        </View>
                    )}
                </View>

                {/* Helper box for testing credentials on shop floor */}
                <View style={styles.helpBox}>
                    <Text style={styles.helpHeader}>Testing/Shop Floor Accounts:</Text>
                    <View style={styles.helpGrid}>
                        <View style={styles.helpRow}><Text style={styles.helpRole}>Operator ID:</Text><Text style={styles.helpCreds}>op201 (PIN: 1234)</Text></View>
                        <View style={styles.helpRow}><Text style={styles.helpRole}>Inspector ID:</Text><Text style={styles.helpCreds}>qc301 (PIN: 1234)</Text></View>
                        <View style={styles.helpRow}><Text style={styles.helpRole}>Admin ID:</Text><Text style={styles.helpCreds}>admin101 (PIN: 1234)</Text></View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#faf9fd' 
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    brandingHeader: {
        alignItems: 'center',
        marginBottom: 36,
    },
    railwayText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#875200',
        letterSpacing: 2,
        marginTop: 8,
    },
    systemTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#002045',
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 12,
    },
    card: {
        backgroundColor: '#ffffff',
        padding: 32,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        position: 'relative',
        overflow: 'hidden',
    },
    accentBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        backgroundColor: '#ffb55c',
    },
    title: { 
        fontSize: 22, 
        fontWeight: '700', 
        marginBottom: 28, 
        textAlign: 'center',
        color: '#002045'
    },
    formGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 1,
        marginBottom: 8
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc', 
        borderRadius: 8, 
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 12,
    },
    inputWrapperFocused: {
        borderColor: '#002045',
        borderWidth: 2,
        backgroundColor: '#ffffff',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: { 
        flex: 1,
        paddingVertical: 14, 
        fontSize: 16,
        color: '#1a1c1e',
    },
    button: { 
        backgroundColor: '#002045', 
        padding: 16, 
        borderRadius: 8, 
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#002045',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonDisabled: {
        backgroundColor: '#adc7f7'
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: { 
        color: '#fff', 
        fontSize: 16, 
        fontWeight: 'bold' 
    },
    helpBox: {
        marginTop: 32,
        padding: 16,
        backgroundColor: '#efedf1',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c4c6cf',
    },
    helpHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#002045',
        marginBottom: 8,
    },
    helpGrid: {
        gap: 4,
    },
    helpRow: {
        flexDirection: 'row',
    },
    helpRole: {
        fontWeight: '600',
        color: '#475569',
        width: 90,
        fontSize: 12,
    },
    helpCreds: {
        color: '#1a1c1e',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    offlineChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fef3c7',
        padding: 10,
        borderRadius: 8,
        marginTop: 16,
        gap: 6,
    },
    offlineChipText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#d97706',
        letterSpacing: 0.5,
    }
});
