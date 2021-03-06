import { MuNumber, MuNumberType } from './_number';
import { MuWriteStream, MuReadStream } from 'mustreams';

export class MuInt32 extends MuNumber {
    constructor(value?:number) {
        super((value || 0) << 0, 'int32');
    }

    public diff (base:number, target:number, stream:MuWriteStream) {
        if ((base << 0) !== (target << 0)) {
            stream.grow(4);
            stream.writeInt32(target);
            return true;
        }
        return false;
    }

    public patch (base:number, stream:MuReadStream) {
        return stream.readInt32();
    }
}
