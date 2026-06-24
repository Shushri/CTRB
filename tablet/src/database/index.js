import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { mySchema } from './schema'
// Normally we'd import the models here e.g. import CTRBRecord from './models/CTRBRecord'

const adapter = new SQLiteAdapter({
    schema: mySchema,
    // (You might want to pass dbName if you have multiple DBs)
    // dbName: 'ctrb_app', 
    jsi: true, /* Enable for faster SQLite access */
    onSetUpError: error => {
        // Database failed to load -- offer the user to reload the app or log out
    }
})

// Create and export the database instance
export const database = new Database({
    adapter,
    modelClasses: [
        // CTRBRecord, InspectionQueue...
    ],
})
