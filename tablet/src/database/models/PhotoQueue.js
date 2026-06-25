import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class PhotoQueue extends Model {
    static table = 'photo_queue'

    @field('ctrb_id') ctrb_id
    @field('local_uri') local_uri
    @field('is_uploaded') is_uploaded
}
