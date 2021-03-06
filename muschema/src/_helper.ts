import {
    MuSchema,
    MuBoolean,
    MuFloat32,
    MuFloat64,
    MuInt8,
    MuInt16,
    MuInt32,
    MuString,
    MuUint8,
    MuUint16,
    MuUint32,
} from './';
import {
    MuReadStream,
    MuWriteStream,
} from 'mustreams';

import {
    Constants,
    muPrimitiveTypes,
} from './_constants';

function randomSign () {
    return Math.random() < 0.5 ? -1 : 1;
}

function fround (float) {
    const fa = new Float32Array(1);
    fa[0] = float;
    return fa[0];
}

const muNumType2SchemaType = {
    'float32': MuFloat32,
    'float64': MuFloat64,
    'int8': MuInt8,
    'int16': MuInt16,
    'int32': MuInt32,
    'uint8': MuUint8,
    'uint16': MuUint16,
    'uint32': MuUint32,
};
export function muNumSchema (muType) {
    return new muNumType2SchemaType[muType]();
}

const muPrimitiveType2SchemaType = {
    'boolean': MuBoolean,
    'float32': MuFloat32,
    'float64': MuFloat64,
    'int8': MuInt8,
    'int16': MuInt16,
    'int32': MuInt32,
    'string': MuString,
    'uint8': MuUint8,
    'uint16': MuUint16,
    'uint32': MuUint32,
};
export function muPrimitiveSchema (muType) {
    return new muPrimitiveType2SchemaType[muType]();
}

export function strOfLeng (length) {
    function randomCodePoint () {
        // to avoid the surrogates issue
        const MAX_CODE_POINT = 0xD7FF;
        return Math.random() * MAX_CODE_POINT | 0;
    }

    const codePoints = new Array(length);
    for (let i = 0; i < length; ++i) {
        codePoints[i] = randomCodePoint();
    }
    return String.fromCharCode.apply(String, codePoints);
}

export function simpleStrOfLeng (length) {
    const ingredient = 'abc';

    const chars = new Array(length);
    for (let i = 0; i < length; ++i) {
        chars[i] = ingredient.charAt(Math.random() * ingredient.length | 0);
    }
    return chars.join('');
}

export function randomStr () {
    const length = Math.random() * 20 + 1 | 0;
    return strOfLeng(length);
}

export function randomShortStr () {
    const length = Math.random() * 3 + 1 | 0;
    return simpleStrOfLeng(length);
}

export function randomFloat32 () {
    return fround(Math.random() * 10 ** (randomSign() * (Math.random() * 38 | 0)));
}

export function randomFloat64 () {
    return Math.random() * 10 ** (randomSign() * (Math.random() * 308 | 0));
}

export function randomValueOf (muType:string) {
    switch (muType) {
        case 'boolean':
            return Math.random() < 0.5 ? false : true;
        case 'float32':
            return randomFloat32();
        case 'float64':
            return randomFloat64();
        case 'int8':
        case 'int16':
        case 'int32':
            return randomSign() * Math.round(Math.random() * Constants[muType].MAX);
        case 'string':
            return randomStr();
        case 'uint8':
        case 'uint16':
        case 'uint32':
            return Math.round(Math.random() * Constants[muType].MAX);
        default:
            return;
    }
}

export function testPatchingFactory (t, schema:MuSchema<any>, fn?) {
    function diffPatch (a, b) {
        const ws = new MuWriteStream(2);
        schema.diff(a, b, ws);
        const rs = new MuReadStream(ws.bytes());
        if (rs.length) {
            const r = schema.patch(a, rs);
            t.equals(rs.offset, rs.length, 'no bytes left in stream');
            return r;
        } else {
            t.same(a, b, 'empty patch consistent');
            return schema.clone(a);
        }
    }

    return  fn ?
            (a, b) => {
                t.same(diffPatch(a, b), fn(b));
            }
            :
            (a, b) => {
                t.same(diffPatch(a, b), b);
            };
}

export function testPatchingPairFactory (t, schema:MuSchema<any>, fn?) {
    const test = fn ? testPatchingFactory(t, schema, fn) : testPatchingFactory(t, schema);

    return (a, b) => {
        test(a, b);
        test(b, a);
    };
}
