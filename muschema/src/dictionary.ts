import { MuSchema } from './schema';
import { MuWriteStream, MuReadStream } from 'mustreams';

export type Dictionary<V extends MuSchema<any>> = {
    [key:string]:V['identity'];
};

export class MuDictionary<ValueSchema extends MuSchema<any>>
        implements MuSchema<Dictionary<ValueSchema>> {
    public readonly identity:Dictionary<ValueSchema>;
    public readonly muType = 'dictionary';
    public readonly muData:ValueSchema;
    public readonly json:object;

    constructor (valueSchema:ValueSchema, id?:Dictionary<ValueSchema>) {
        this.identity = id || {};
        this.muData = valueSchema;
        this.json = {
            type: 'dictionary',
            valueType: this.muData.json,
            identity: JSON.stringify(this.identity),
        };
    }

    public alloc () : Dictionary<ValueSchema> { return {}; }

    public free (x:Dictionary<ValueSchema>) {
        const valueSchema = this.muData;
        const props = Object.keys(x);
        for (let i = 0; i < props.length; ++i) {
            valueSchema.free(x[props[i]]);
        }
    }

    public clone (x:Dictionary<ValueSchema>) : Dictionary<ValueSchema> {
        const result:Dictionary<ValueSchema> = {};
        const props = Object.keys(x);
        const schema = this.muData;
        for (let i = 0; i < props.length; ++i) {
            result[props[i]] = schema.clone(x[props[i]]);
        }
        return result;
    }

    public diff (
        base:Dictionary<ValueSchema>,
        target:Dictionary<ValueSchema>,
        stream:MuWriteStream,
    ) : boolean {
        stream.grow(32);

        let numRemove = 0;
        let numPatch = 0;

        // mark the initial offset
        const removeCounterOffset = stream.offset;
        const patchCounterOffset = removeCounterOffset + 4;
        stream.offset = removeCounterOffset + 8;

        const baseProps = Object.keys(base);
        for (let i = 0; i < baseProps.length; ++i) {
            const prop = baseProps[i];
            if (!(prop in target)) {
                stream.grow(4 + 4 * prop.length);
                stream.writeString(prop);
                ++numRemove;
            }
        }

        const valueSchema = this.muData;
        const targetProps = Object.keys(target);
        for (let i = 0; i < targetProps.length; ++i) {
            const prefixOffset = stream.offset;

            const prop = targetProps[i];
            stream.grow(4 + 4 * prop.length);
            stream.writeString(prop);

            if (prop in base) {
                if (valueSchema.diff(base[prop], target[prop], stream)) {
                    ++numPatch;
                } else {
                    stream.offset = prefixOffset;
                }
            } else {
                if (!valueSchema.diff(valueSchema.identity, target[prop], stream)) {
                    stream.buffer.uint8[prefixOffset + 3] |= 0x80;
                }
                ++numPatch;
            }
        }

        if (numPatch > 0 || numRemove > 0) {
            stream.writeUint32At(removeCounterOffset, numRemove);
            stream.writeUint32At(patchCounterOffset, numPatch);
            return true;
        } else {
            stream.offset = removeCounterOffset;
            return false;
        }
    }

    public patch (
        base:Dictionary<ValueSchema>,
        stream:MuReadStream,
    ) : Dictionary<ValueSchema> {
        const result:Dictionary<ValueSchema> = {};
        const valueSchema = this.muData;

        const numRemove = stream.readUint32();
        const numPatch = stream.readUint32();

        const propsToRemove = {};
        for (let i = 0; i < numRemove; ++i) {
            propsToRemove[stream.readString()] = true;
        }

        const props = Object.keys(base);
        for (let i = 0; i < props.length; ++i) {
            const prop = props[i];
            if (propsToRemove[prop]) {
                continue;
            }
            result[prop] = valueSchema.clone(base[prop]);
        }

        for (let i = 0; i < numPatch; ++i) {
            const isIdentity = stream.buffer.uint8[stream.offset + 3] & 0x80;
            stream.buffer.uint8[stream.offset + 3] &= ~0x80;
            const prop = stream.readString();
            if (prop in base) {
                result[prop] = valueSchema.patch(base[prop], stream);
            } else if (isIdentity) {
                result[prop] = valueSchema.clone(valueSchema.identity);
            } else {
                result[prop] = valueSchema.patch(valueSchema.identity, stream);
            }
        }

        return result;
    }
}
