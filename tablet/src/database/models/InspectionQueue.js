import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class InspectionQueue extends Model {
    static table = 'inspections'

    @field('ctrb_id') ctrb_id
    @field('component') component
    @field('type') type // visual vs dimensional
    @field('payload') payload // JSON stringified data
    @field('is_synced') is_synced
}
