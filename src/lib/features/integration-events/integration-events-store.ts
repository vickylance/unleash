import { CRUDStore, type CrudStoreConfig } from '../../db/crud/crud-store';
import type { Db } from '../../db/db';
import type { IntegrationEventSchema } from '../../openapi/spec/integration-event-schema';

export type IntegrationEventWriteModel = Omit<
    IntegrationEventSchema,
    'id' | 'createdAt'
>;

export type IntegrationEventState = IntegrationEventWriteModel['state'];

export class IntegrationEventsStore extends CRUDStore<
    IntegrationEventSchema,
    IntegrationEventWriteModel
> {
    constructor(db: Db, config: CrudStoreConfig) {
        super('integration_events', db, config);
    }

    async getPaginatedEvents(
        id: number,
        limit: number,
        offset: number,
    ): Promise<IntegrationEventSchema[]> {
        const rows = await this.db(this.tableName)
            .where('integration_id', id)
            .limit(limit)
            .offset(offset)
            .orderBy('id', 'desc');

        return rows.map(this.fromRow) as IntegrationEventSchema[];
    }

    async cleanUpEvents(): Promise<void> {
        return this.db
            .with('latest_events', (qb) => {
                qb.select('id')
                    .from(this.tableName)
                    .whereRaw(`created_at >= now() - INTERVAL '2 hours'`)
                    .orderBy('created_at', 'desc')
                    .limit(100);
            })
            .from(this.tableName)
            .whereNotIn('id', this.db.select('id').from('latest_events'))
            .delete();
    }
}
