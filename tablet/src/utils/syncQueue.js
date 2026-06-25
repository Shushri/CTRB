import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database';
import apiClient from '../api/apiClient';

let lastAlertTime = 0;

export const isServerReachable = async () => {
    try {
        await apiClient.get('/health', { timeout: 2000 });
        return true;
    } catch (e) {
        return false;
    }
};

export const syncOfflineData = async (showFeedback = false) => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        if (token === 'mock-offline-token') {
            console.log('Skipping sync for offline mock token');
            return false;
        }

        const inspectionsRef = database.collections.get('inspections');
        const pendingInspections = await inspectionsRef.query().fetch();
        const pendingToSync = pendingInspections.filter(item => !item.is_synced);

        if (pendingToSync.length === 0) {
            if (showFeedback) {
                Alert.alert('Sync Status', 'All inspection logs are synced with the server.');
            }
            return true;
        }

        const reachable = await isServerReachable();
        if (!reachable) {
            const now = Date.now();
            if (now - lastAlertTime > 60000 || showFeedback) {
                lastAlertTime = now;
                Alert.alert(
                    'Offline Mode',
                    'Server unreachable — working offline. Your inspection logs are saved locally and will sync when connection returns.'
                );
            }
            return false;
        }

        for (const item of pendingToSync) {
            const payload = JSON.parse(item.payload);
            
            // Determine API endpoint depending on inspection type
            let endpoint = '';
            let apiPayload = { ...payload };
            
            if (item.type === 'visual') {
                endpoint = '/inspections/visual';
                if (apiPayload.replacement) delete apiPayload.replacement;
            } else {
                endpoint = '/inspections/dimensional';
                apiPayload = {
                    ctrb_id: payload.ctrb_id,
                    component: payload.component,
                    measurements: [
                        {
                            param_key: payload.param_key,
                            measured_value: payload.measured_value
                        }
                    ]
                };
            }

            try {
                const inspectionRes = await apiClient.post(endpoint, apiPayload);
                
                if (payload.replacement) {
                    const replacementPayload = {
                        ctrb_id: payload.ctrb_id,
                        component: payload.replacement.component,
                        rejection_cause: payload.replacement.rejection_cause,
                        replacement_part_number: payload.replacement.replacement_part_number,
                        notes: payload.replacement.notes
                    };

                    try {
                        await apiClient.post('/assembly/replacements', replacementPayload);
                        console.log('Synced replacement link for component:', payload.component);
                    } catch (repErr) {
                        console.log('Failed to sync replacement link during sync:', repErr.message);
                    }
                }

                await database.write(async () => {
                    await item.update(record => {
                        record.is_synced = true;
                    });
                });
            } catch (netErr) {
                console.log("Sync partial failure on record", item.id, netErr.message);
            }
        }
        return true;
    } catch (e) {
        console.log("Queue Drain Error:", e);
        return false;
    }
};
