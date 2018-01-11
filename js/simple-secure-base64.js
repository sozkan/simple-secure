/*
 * originally from https://github.com/beatgammit/base64-js with some changes
 * https://github.com/beatgammit/base64-js is distributed under an MIT license.
 * The following license applies to this file only
 * 
 The MIT License (MIT)

Copyright (c) 2014

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
class SOC_base64 {
    constructor() {
        this.lookup = [];
        this.revLookup = [];
        this.Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
        this.code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        for (var i = 0, len = this.code.length; i < len; ++i) {
            this.lookup[i] = this.code[i];
            this.revLookup[this.code.charCodeAt(i)] = i;
        }

        this.revLookup['-'.charCodeAt(0)] = 62;
        this.revLookup['_'.charCodeAt(0)] = 63;

    }

    placeHoldersCount(b64) {
        var len = b64.length;
        if (len % 4 > 0) {
            throw new Error('Invalid string. Length must be a multiple of 4');
        }

        // the number of equal signs (place holders)
        // if there are two placeholders, than the two characters before it
        // represent one byte
        // if there is only one, then the three characters before it represent 2 bytes
        // this is just a cheap hack to not do indexOf twice
        return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;
    }

    byteLength(b64) {
        // base64 is 4/3 + up to two characters of the original data
        return (b64.length * 3 / 4) - this.placeHoldersCount(b64);
    }

    
    decodeAsString(b64){
        let decoded_bytes = this.decodeAsByteArray(b64);
        let txtdecoder = new TextDecoder('utf-8');
        let decoded_str = txtdecoder.decode(decoded_bytes);
        return decoded_str;
    }

    decodeAsByteArray(b64) {
        var i, l, tmp, placeHolders, arr;
        var len = b64.length;
        placeHolders = this.placeHoldersCount(b64);

        arr = new this.Arr((len * 3 / 4) - placeHolders);

        // if there are placeholders, only get up to the last complete 4 chars
        l = placeHolders > 0 ? len - 4 : len;

        var L = 0;

        for (i = 0; i < l; i += 4) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 18) | (this.revLookup[b64.charCodeAt(i + 1)] << 12) |
                    (this.revLookup[b64.charCodeAt(i + 2)] << 6) | this.revLookup[b64.charCodeAt(i + 3)]
            arr[L++] = (tmp >> 16) & 0xFF;
            arr[L++] = (tmp >> 8) & 0xFF;
            arr[L++] = tmp & 0xFF;
        }

        if (placeHolders === 2) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 2) | (this.revLookup[b64.charCodeAt(i + 1)] >> 4)
            arr[L++] = tmp & 0xFF;
        } else if (placeHolders === 1) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 10) | (this.revLookup[b64.charCodeAt(i + 1)] << 4)
                    | (this.revLookup[b64.charCodeAt(i + 2)] >> 2)
            arr[L++] = (tmp >> 8) & 0xFF;
            arr[L++] = tmp & 0xFF;
        }

        return arr;
    }
    
    tripletToBase64(num) {
        return this.lookup[num >> 18 & 0x3F] + this.lookup[num >> 12 & 0x3F] + this.lookup[num >> 6 & 0x3F]
                + this.lookup[num & 0x3F];
    }

    encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i = start; i < end; i += 3) {
            tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
            output.push(this.tripletToBase64(tmp));
        }
        return output.join('')
    }

    encodeBytes(uint8) {
        var tmp;
        var len = uint8.length;
        var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
        var output = '';
        var parts = [];
        var maxChunkLength = 16383; // must be multiple of 3

        // go through the array every three bytes, we'll deal with trailing stuff later
        for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
            parts.push(this.encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
        }

        // pad the end with zeros, but make sure to not forget the extra bytes
        if (extraBytes === 1) {
            tmp = uint8[len - 1]
            output += this.lookup[tmp >> 2]
            output += this.lookup[(tmp << 4) & 0x3F]
            output += '=='
        } else if (extraBytes === 2) {
            tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
            output += this.lookup[tmp >> 10];
            output += this.lookup[(tmp >> 4) & 0x3F];
            output += this.lookup[(tmp << 2) & 0x3F];
            output += '=';
        }

        parts.push(output);

        return parts.join('');
    }
    
    
    encodeString(str, encoding = 'utf-8'){
        let txtencoder = new TextEncoder(encoding);
        var bytes = txtencoder.encode(str);
        return this.encodeBytes(bytes);
    }
}




/*
 * to implement base64url encoding,
 * just creating a copy of the original code and changing the relevant parts
 * instead of adding code to the original class
 * 
 */
class SOC_base64URL {
    constructor() {
        this.lookup = [];
        this.revLookup = [];
        this.Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
        this.code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        for (var i = 0, len = this.code.length; i < len; ++i) {
            this.lookup[i] = this.code[i];
            this.revLookup[this.code.charCodeAt(i)] = i;
        }

        this.revLookup['-'.charCodeAt(0)] = 62;
        this.revLookup['_'.charCodeAt(0)] = 63;

    }

    placeHoldersCount(b64) {
        var len = b64.length;
        if (len % 4 > 0) {
            throw new Error('Invalid string. Length must be a multiple of 4');
        }

        // the number of equal signs (place holders)
        // if there are two placeholders, than the two characters before it
        // represent one byte
        // if there is only one, then the three characters before it represent 2 bytes
        // this is just a cheap hack to not do indexOf twice
        return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;
    }

    byteLength(b64) {
        // base64 is 4/3 + up to two characters of the original data
        return (b64.length * 3 / 4) - this.placeHoldersCount(b64);
    }

    
    decodeAsString(b64){
        let decoded_bytes = this.decodeAsByteArray(b64);
        let txtdecoder = new TextDecoder('utf-8');
        let decoded_str = txtdecoder.decode(decoded_bytes);
        return decoded_str;
    }

    decodeAsByteArray(b64) {
        var i, l, tmp, placeHolders, arr;
        var len = b64.length;
        placeHolders = this.placeHoldersCount(b64);

        arr = new this.Arr((len * 3 / 4) - placeHolders);

        // if there are placeholders, only get up to the last complete 4 chars
        l = placeHolders > 0 ? len - 4 : len;

        var L = 0;

        for (i = 0; i < l; i += 4) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 18) | (this.revLookup[b64.charCodeAt(i + 1)] << 12) |
                    (this.revLookup[b64.charCodeAt(i + 2)] << 6) | this.revLookup[b64.charCodeAt(i + 3)]
            arr[L++] = (tmp >> 16) & 0xFF;
            arr[L++] = (tmp >> 8) & 0xFF;
            arr[L++] = tmp & 0xFF;
        }

        if (placeHolders === 2) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 2) | (this.revLookup[b64.charCodeAt(i + 1)] >> 4)
            arr[L++] = tmp & 0xFF;
        } else if (placeHolders === 1) {
            tmp = (this.revLookup[b64.charCodeAt(i)] << 10) | (this.revLookup[b64.charCodeAt(i + 1)] << 4)
                    | (this.revLookup[b64.charCodeAt(i + 2)] >> 2)
            arr[L++] = (tmp >> 8) & 0xFF;
            arr[L++] = tmp & 0xFF;
        }

        return arr;
    }
    
    tripletToBase64(num) {
        return this.lookup[num >> 18 & 0x3F] + this.lookup[num >> 12 & 0x3F] + this.lookup[num >> 6 & 0x3F]
                + this.lookup[num & 0x3F];
    }

    encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i = start; i < end; i += 3) {
            tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
            output.push(this.tripletToBase64(tmp));
        }
        return output.join('')
    }

    encodeBytes(uint8) {
        var tmp;
        var len = uint8.length;
        var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
        var output = '';
        var parts = [];
        var maxChunkLength = 16383; // must be multiple of 3

        // go through the array every three bytes, we'll deal with trailing stuff later
        for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
            parts.push(this.encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
        }

        // pad the end with zeros, but make sure to not forget the extra bytes
        if (extraBytes === 1) {
            tmp = uint8[len - 1]
            output += this.lookup[tmp >> 2]
            output += this.lookup[(tmp << 4) & 0x3F]
            output += '=='
        } else if (extraBytes === 2) {
            tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
            output += this.lookup[tmp >> 10];
            output += this.lookup[(tmp >> 4) & 0x3F];
            output += this.lookup[(tmp << 2) & 0x3F];
            output += '=';
        }

        parts.push(output);

        return parts.join('');
    }
   
    
    encodeString(str, encoding = 'utf-8'){
        let txtencoder = new TextEncoder(encoding);
        var bytes = txtencoder.encode(str);
        return this.encodeBytes(bytes);
    }
}