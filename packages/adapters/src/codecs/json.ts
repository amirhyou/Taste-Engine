import { z } from 'zod';
import { ComparisonEventSchema } from '../schemas/comparisonEvent';
import { RunConfigSerializedSchema } from '../schemas/runConfig';
import { EngineSnapshotSchema } from '../schemas/engineSnapshot';

function makeJsonCodec<T extends z.ZodTypeAny>(schema: T) {
    return {
        parse(json: string): z.infer<T> {
            const raw = JSON.parse(json);
            return schema.parse(raw);
        },
        stringify(value: z.infer<T>): string {
            schema.parse(value);
            return JSON.stringify(value);
        },
        safeParse(json: string): { success: true; data: z.infer<T> } | { success: false; error: Error } {
            try {
                return { success: true, data: this.parse(json) };
            } catch (e) {
                return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
            }
        },
    };
}

export const ComparisonEventCodec = makeJsonCodec(ComparisonEventSchema);
export const RunConfigCodec = makeJsonCodec(RunConfigSerializedSchema);
export const EngineSnapshotCodec = makeJsonCodec(EngineSnapshotSchema);
