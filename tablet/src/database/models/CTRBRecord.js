import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class CTRBRecord extends Model {
    static table = 'ctrb_records'

    @field('ctrb_number') ctrb_number
    @field('job_id') job_id
    @field('make') make
    @field('date_received') date_received
    @field('status') status
}
