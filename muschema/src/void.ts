import { MuSchema } from './schema';
import { MuWriteStream, MuReadStream } from 'mustreams';

/** The empty type */
export class MuVoid implements MuSchema<void> {
    public readonly identity = undefined;
    public readonly muType = 'void';
    public readonly json = {
        type: 'void',
    };

    public alloc () : void { }
    public free (_:void) : void { }
    public clone (_:void) : void { }
    public diff (b, t, stream:MuWriteStream) { return false; }
    public patch (b, stream:MuReadStream) : void { }
}
