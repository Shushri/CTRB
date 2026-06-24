import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'ctrb_records',
            columns: [
                { name: 'ctrb_number', type: 'string', isIndexed: true },
                { name: 'job_id', type: 'string' },
                { name: 'make', type: 'string' },
                { name: 'date_received', type: 'string' },
                { name: 'status', type: 'string' },
            ],
        }),
        tableSchema({
            name: 'inspections',
            columns: [
                { name: 'ctrb_id', type: 'string', isIndexed: true },
                { name: 'component', type: 'string' },
                { name: 'type', type: 'string' }, // 'visual' or 'dimensional'
                { name: 'payload', type: 'string' }, // JSONified body to sync upward
                { name: 'is_synced', type: 'boolean' }
            ]
        }),
        tableSchema({
            name: 'photo_queue',
            columns: [
                { name: 'ctrb_id', type: 'string' },
                { name: 'local_uri', type: 'string' },
                { name: 'is_uploaded', type: 'boolean' }
            ]
        })
    ]
})
