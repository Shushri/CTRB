import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import Constants from 'expo-constants'

import { mySchema } from './schema'
import CTRBRecord from './models/CTRBRecord'
import InspectionQueue from './models/InspectionQueue'
import PhotoQueue from './models/PhotoQueue'

// Detect if running under Expo Go to set appropriate JSI mode
const isExpoGo = Constants.appOwnership === 'expo'

const adapter = new SQLiteAdapter({
    schema: mySchema,
    // (You might want to pass dbName if you have multiple DBs)
    // dbName: 'ctrb_app', 
    jsi: !isExpoGo, /* Enable JSI for faster SQLite access only when not running inside Expo Go */
    onSetUpError: error => {
        // Database failed to load -- offer the user to reload the app or log out
    }
})

// Create and export the database instance
export const database = new Database({
    adapter,
    modelClasses: [
        CTRBRecord,
        InspectionQueue,
        PhotoQueue,
    ],
})
