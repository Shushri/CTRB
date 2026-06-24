import { database } from '../database';
import apiClient from '../api/apiClient';

export const syncOfflineData = async () => {
    try {
        // Fetch all offline inspections
        const inspectionsRef = database.collections.get('inspections');
        const pendingInspections = await inspectionsRef.query().fetch();

        for (const item of pendingInspections) {
            if (!item.is_synced) {
                // Determine API endpoint depending on inspection type
                const endpoint = item.type === 'visual' ? '/inspections/visual' : '/inspections/dimensional';
                const payload = JSON.parse(item.payload);

                try {
                    await apiClient.post(endpoint, payload);
                    // Mark as synced locally
                    await database.write(async () => {
                        await item.update(record => {
                            record.is_synced = true;
                        });
                    });
                } catch (netErr) {
                    console.error("Sync partial failure on record", item.id, netErr);
                }
            }
        }

    } catch (e) {
        console.error("Queue Drain Error:", e);
    }
};
