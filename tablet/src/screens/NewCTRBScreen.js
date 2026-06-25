import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import apiClient from '../api/apiClient';

export default function NewCTRBScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [ctrbNumber, setCtrbNumber] = useState('');
    const [make, setMake] = useState('timken');
    const [source, setSource] = useState('scheduled_maint');
    const [loading, setLoading] = useState(false);
    const [operatorId, setOperatorId] = useState('');
    const [focusedInput, setFocusedInput] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setOperatorId(user.id);
                }
            } catch (err) {
                console.error('Failed to load user info', err);
            }
        };
        loadUser();
    }, []);

    const makes = ['timken', 'nei', 'fag', 'skf', 'brenco', 'koyo', 'other'];
    const sources = [
        { label: 'Scheduled Maint', value: 'scheduled_maint', icon: 'calendar-clock' },
        { label: 'Failure', value: 'failure', icon: 'alert-decagram' },
        { label: 'New Install', value: 'new_install', icon: 'plus-circle' },
        { label: 'Other', value: 'other', icon: 'help-circle' }
    ];

    const getCtrbNumberWarning = () => {
        if (!ctrbNumber) return null;
        if (ctrbNumber.trim().length < 6) return 'Serials are typically at least 6 characters.';
        // General warning if containing characters that are not standard alpha-numeric or dashes
        if (!/^[A-Z0-9-]+$/i.test(ctrbNumber)) return 'Warning: Standard serials are alphanumeric and dashes only.';
        return null;
    };

    const handleSave = async () => {
        const normalizedNum = ctrbNumber.trim().toUpperCase();
        if (!normalizedNum) {
            Alert.alert('Validation Error', 'CTRB Serial Number is required');
            return;
        }

        setLoading(true);
        const payload = {
            ctrb_number: normalizedNum,
            make: make,
            date_received: new Date().toISOString(),
            source: source,
            operator_id: operatorId || 'mock-operator-id',
            initial_status: 'received'
        };

        try {
            let savedRecord = null;
            
            // Try to sync with server first
            try {
                const apiRes = await apiClient.post('/ctrb', payload);
                savedRecord = apiRes.data?.data;
                console.log('Successfully saved to backend:', savedRecord);
            } catch (apiErr) {
                console.log('Failed to post CTRB to API, saving offline-only...', apiErr.message);
            }

            // Save to local WatermelonDB database
            await database.write(async () => {
                await database.collections.get('ctrb_records').create(record => {
                    record.ctrb_number = payload.ctrb_number;
                    record.job_id = savedRecord?.job_id || `JOB-OFFLINE-${Date.now()}`;
                    record.make = payload.make;
                    record.date_received = payload.date_received;
                    record.status = payload.initial_status;
                });
            });

            Alert.alert(
                'Success', 
                savedRecord 
                    ? 'Record saved and synced with server successfully.' 
                    : 'Saved locally in Offline Mode. It will sync when connection returns.',
                [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
            );
        } catch (err) {
            Alert.alert('Database Error', 'Failed to save CTRB record locally.');
            console.error('Local save error:', err);
        } finally {
            setLoading(false);
        }
    };

    const warning = getCtrbNumberWarning();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafd' }} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
            >
                {/* Top Bar Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#002045" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Intake New CTRB</Text>
                    <View style={{ width: 24 }} />
                </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.accentBorder} />
                    
                    {/* CTRB Input */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>CTRB SERIAL NUMBER / ID</Text>
                        <View style={[
                            styles.inputWrapper, 
                            focusedInput && styles.inputWrapperFocused
                        ]}>
                            <MaterialCommunityIcons name="barcode-scan" size={22} color={focusedInput ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.input} 
                                placeholder="Enter CTRB Serial (e.g. TIM-9021)" 
                                placeholderTextColor="#94a3b8"
                                value={ctrbNumber} 
                                onChangeText={setCtrbNumber}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                onFocus={() => setFocusedInput(true)}
                                onBlur={() => setFocusedInput(false)}
                            />
                        </View>
                        {warning && (
                            <View style={styles.warningContainer}>
                                <MaterialCommunityIcons name="alert" size={14} color="#d97706" />
                                <Text style={styles.warningText}>{warning}</Text>
                            </View>
                        )}
                    </View>

                    {/* Make Selector */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>MAKE (MANUFACTURER BRAND)</Text>
                        <View style={styles.makeSelectorGrid}>
                            {makes.map((m) => {
                                const isActive = make === m;
                                return (
                                    <TouchableOpacity 
                                        key={m} 
                                        style={[styles.makeButton, isActive && styles.makeButtonActive]}
                                        onPress={() => setMake(m)}
                                    >
                                        <MaterialCommunityIcons 
                                            name="cog-outline" 
                                            size={16} 
                                            color={isActive ? '#ffffff' : '#64748b'} 
                                        />
                                        <Text style={[styles.makeButtonText, isActive && styles.makeButtonTextActive]}>
                                            {m.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Source Selector */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>RECEIPT SOURCE / CLASSIFICATION</Text>
                        <View style={styles.sourceSelectorGrid}>
                            {sources.map((s) => {
                                const isActive = source === s.value;
                                return (
                                    <TouchableOpacity 
                                        key={s.value} 
                                        style={[styles.sourceButton, isActive && styles.sourceButtonActive]}
                                        onPress={() => setSource(s.value)}
                                    >
                                        <MaterialCommunityIcons 
                                            name={s.icon} 
                                            size={20} 
                                            color={isActive ? '#ffffff' : '#475569'} 
                                            style={styles.sourceIcon}
                                        />
                                        <Text style={[styles.sourceButtonText, isActive && styles.sourceButtonTextActive]}>
                                            {s.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity 
                        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.saveButtonContent}>
                                <MaterialCommunityIcons name="check" size={22} color="white" />
                                <Text style={styles.saveButtonText}>Complete Intake & Log Record</Text>
                            </View>
                        )}
                    </TouchableOpacity>
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
        padding: 24, 
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#002045',
    },
    card: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
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
    formGroup: { 
        marginBottom: 24 
    },
    label: { 
        fontSize: 11, 
        fontWeight: '800', 
        color: '#475569', 
        letterSpacing: 1,
        marginBottom: 10 
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
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingHorizontal: 4,
    },
    warningText: {
        fontSize: 12,
        color: '#d97706',
        fontWeight: '600',
        marginLeft: 4,
    },
    makeSelectorGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: 8 
    },
    makeButton: { 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9', 
        paddingVertical: 12, 
        paddingHorizontal: 16, 
        borderRadius: 8, 
        borderWidth: 1,
        borderColor: '#cbd5e1',
        gap: 6,
        minWidth: '30%',
    },
    makeButtonActive: { 
        backgroundColor: '#002045',
        borderColor: '#002045'
    },
    makeButtonText: { 
        fontSize: 12, 
        color: '#475569', 
        fontWeight: '700', 
        textAlign: 'center' 
    },
    makeButtonTextActive: { 
        color: '#ffffff' 
    },
    sourceSelectorGrid: {
        gap: 8,
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        padding: 14,
        borderRadius: 8,
    },
    sourceButtonActive: {
        backgroundColor: '#002045',
        borderColor: '#002045',
    },
    sourceIcon: {
        marginRight: 12,
    },
    sourceButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    sourceButtonTextActive: {
        color: '#ffffff',
    },
    saveButton: { 
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
    saveButtonDisabled: {
        backgroundColor: '#adc7f7'
    },
    saveButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveButtonText: { 
        color: '#fff', 
        fontSize: 16, 
        fontWeight: 'bold' 
    }
});
