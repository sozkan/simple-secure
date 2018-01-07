/**
 * base and crypto stuff for the Simple Secure application
 * all original classes/functions are prefixed with SOC_
 * global variables are named socglobal_XXX
 */


////////////global functions 
/**
 * hex encoding
 * @param {Uint8Array} uint8arrayinstance
 * @returns {String}
 */
function SOC_hexEncode(uint8arrayinstance){
    let hex, i;
    let result = "";
    for (i=0; i<uint8arrayinstance.length; i++) {
        hex = uint8arrayinstance[i].toString(16);
        result += ("00"+hex).slice(-2);
    }
    return result;
}

/**
 * creates random data
 * @param int bytes_length
 * @returns {Uint8Array} a buffer filled with random stuff
 */
function SOC_getRandomBytes(bytes_length){
    let buffer = new Uint8Array(bytes_length);
    window.crypto.getRandomValues(buffer);
    return buffer;
}

/**
 * we use a constant salt 
 * @returns {SOC_get_saltforpbkdf_derivebits.salt_buffersource|Uint8Array}
 */
function SOC_get_saltforpbkdf_derivebits(numiterations){
    let salt_buffersource = new Uint8Array(16);
    salt_buffersource.fill(numiterations % 255);
    return salt_buffersource;

}

/**
 * 
 * @returns {undefined}
 */
function SOC_sha256(input_str, finished_callback, error_callback){
    let txtencoder = new TextEncoder('utf-8');
    let input_buffer = txtencoder.encode(input_str);
    window.crypto.subtle.digest("SHA-256", input_buffer).
        then(hashbytes=>{
            finished_callback(hashbytes);
        }).catch(error=>{
            console.log(error);
            SOC_log(1,'SOC_sha256',error);
            error_callback(error);
        });
}

function SOC_sha256_to_manualcheckvalues(hash_buffer){
    let uint8array = new Uint8Array(hash_buffer);
    let sum = 0;
    let fourpiecesum = [0,0,0,0];
    for(let i=0;i<uint8array.length;i++){
        sum += uint8array[i];
        fourpiecesum[i%4]=fourpiecesum[i%4]+uint8array[i];
    }
    let hashstr = SOC_hexEncode(uint8array);
    let splithash = hashstr.match(/.{1,2}/g);
    //let joinedhash = splithash.join(' ');
    let rv ={
        checksum: sum,
        foursum : fourpiecesum.join('-'),
        hash: splithash
    };
    return rv;
}

class SOC_Base{
    constructor(){
        //callback function that accepts 1 parameter to be called in case of an error
        this.error_callback=null;
    }
    
    /**
     * 
     * @param string errorcode
     * @param {any} rawerror
     * @returns void
     */
    raiseError(errorcode, rawerror){
        SOC_log(1, errorcode+':'+rawerror);
        if(this.error_callback){
            this.error_callback(rawerror);
        }
    }
    
    beginSHA256(input_bytearray, finished_callback, error_callback){
        SOC_log(5, 'SOC_Base.beginSHA256', 'Enter');
        window.crypto.subtle.digest("SHA-256", input_bytearray).then(hashbytes=>{
            finished_callback(hashbytes);
      }).error(error=>{
          error_callback(error);
      });
    }
}

/**
 * RSA OAEP implementation
 * modulus length: 2048
 * hash : SHA-256
 * generates a new key pair or imports an existing private key
 */
class SOC_RSA_OAEP extends SOC_Base{
    constructor(){
        super();
        this.algorithm = {
            name: "RSA-OAEP",
            modulusLength: 2048, 
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: {name: "SHA-256"}
        };
        
        this.signatureAlgo ='HMAC';
        this.encryptDecryptAlgo = {"name": "RSA-OAEP"};
    }
    /**
     * generates a new key pair
     * @param callback_onfinish function(keytype, cryptokey) 
     * @param error_callback function(error) 
     * @returns void
     */
    beginGenerateNewPair(callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair', 'Enter');
        this.error_callback = error_callback;
        
        let usages = ["encrypt", "decrypt"];
        let currentinstance = this;
        let generatekeyPromise = window.crypto.subtle.generateKey(this.algorithm, true, usages);
        generatekeyPromise.then(keypair=>{
            currentinstance.generateNewPair_Step_2(currentinstance, callback_onfinish, error_callback, keypair);
        })
        .catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.generateNewPair', error);
            currentinstance.raiseError('SOC_RSA_OAEP:newpair', error);
        });
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair', 'Exit');
    }

    generateNewPair_Step_2(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair_Step_2', 'Enter');
        let privatePromise = window.crypto.subtle.exportKey('jwk', keypair.privateKey);
        privatePromise.then(privatejwk=>{
            socglobal_stateobject.privatekey = privatejwk; 
            currentinstance.generateNewPair_Step_3(currentinstance, callback_onfinish, error_callback, keypair);
        }).
        catch(privateError=>{
            SOC_log(1, 'SOC_RSA_OAEP.generateNewPair_Step_2', 'Error exporting the private key=' + privateError);
            currentinstance.raiseError('SOC_RSA_OAEP:generateNewPair_Step_2', privateError);
        });
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair_Step_2', 'Exit');
    }
    
    generateNewPair_Step_3(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair_Step_3', 'Enter');
        let publicPromise = window.crypto.subtle.exportKey('jwk', keypair.publicKey);
        publicPromise.then(publicjwk=>{
            let publickeyjwkstring = JSON.stringify(publicjwk);
            SOC_log(4, 'SOC_RSA_OAEP.generateNewPair_Step_3', 'New public key:' + publickeyjwkstring);
            socglobal_stateobject.publickey = publickeyjwkstring; 
            currentinstance.generateNewPair_Finished(currentinstance, callback_onfinish, error_callback, keypair);
        })
        .catch(publicError=>{
            SOC_log(1, 'SOC_RSA_OAEP.generateNewPair_Step_3', 'Error exporting the public key=' + publicError);
            currentinstance.raiseError('SOC_RSA_OAEP:generateNewPair_Step_3', publicError);
            //callback_onfinish(false);
        });                    
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair_Step_3', 'Exit');
    }
    
    generateNewPair_Finished(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSA_OAEP.generateNewPair_Finished', 'Enter');
        callback_onfinish(true);                
    }
    /**
     * imports a pkcs8 key
     * @param keydata
     * @returns the Promise from window.crypto.subtle.importKey 
     */
    beginImportPkcs8(keydata){        
        let usages = ["encrypt", "decrypt"];
        return window.crypto.subtle.importKey('pkcs8', keydata, this.algorithm, true, usages);
    }
    /**
     * 
     * @param {JSONWebKey} key_jwk_obj
     * @returns void
     */
    beginImportJwkPrivateKey(key_jwk_obj, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginImportJwkPrivateKey', 'Enter');
        let usages = ["decrypt"];
        //key_jwk_obj.key_ops = usages;
        let import_promise = window.crypto.subtle.importKey('jwk', key_jwk_obj, this.algorithm, false, usages);
        import_promise.then(cryptokey=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginImportJwkPrivateKey', 'Imported the key');
            callback_onfinish(cryptokey);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginImportJwkPrivateKey', 'Error importing the key:' + JSON.stringify(error));
            error_callback(error);
        });
        
    }  
    
    /**
     * used to import contacts' public keys
     * @param {JSONWebKey} publickey_jwk_obj
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginImportJwkPublicKey(publickey_jwk_obj, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginImportJwkPublicKey', 'Enter');
        let usages = ["encrypt"];
        let import_promise = window.crypto.subtle.importKey('jwk', publickey_jwk_obj, this.algorithm, false, usages);
        import_promise.then(cryptokey=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginImportJwkPublicKey', 'Imported the key');
            callback_onfinish(cryptokey);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginImportJwkPublicKey', 'Error importing the key:' + JSON.stringify(error));
            error_callback(error);
        });
        
    }  

    /**
     * DIDNT WORK, IT REALLY DOESNT ALLOW YOU TO USE THE SAME KEY FOR SIGNING AND ENCRYPTION!!!
     * Webcrypto does not allow rsa-oaep keys to be used for signing and verification
     * but we don't want to manage a separate key just for signing and verification
     * so we will just use the same private key and use our non-standard sign/verify methods 
     * @param {JSONWebKey} privatekey_jwk_obj
     * @param {ArrayBuffer} data_sha256_bytes sha256 of the data to be signed
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginSign(privatekey_jwk_obj, data_sha256_bytes, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginSign', 'Enter');        
        this.beginEncrypt(privatekey_jwk_obj, data_sha256_bytes, callback_onfinish, error_callback);               
    }
    
    /**
     * DIDNT WORK, IT REALLY DOESNT ALLOW YOU TO USE THE SAME KEY FOR SIGNING AND ENCRYPTION!!!
     * @param {type} publickey_jwk_obj
     * @param {type} ciphertext_buffer
     * @param {type} arraybuffer_toverify
     * @param {type} callback_onfinish
     * @param {type} error_callback
     * @returns {boolean}
     */
    beginVerifySignature(publickey_jwk_obj, ciphertext_buffer, arraybuffer_toverify, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginVerifySignature', 'Enter');
        if(!ciphertext_buffer || !arraybuffer_toverify)
        {
            return false;
        }
        let the_promise = window.crypto.subtle.decrypt(this.encryptDecryptAlgo, publickey_jwk_obj, ciphertext_buffer);
        the_promise.then(plaintext_buffer=>{
            //now all elements of arraybuffer_toverify must be equal to plaintext_buffer
            let plainuint8 = new Uint8Array(plaintext_buffer);
            let verificationbufferuint8 = new Uint8Array(arraybuffer_toverify);
            //they are obviously not equal
            if(plainuint8.byteLength!==verificationbufferuint8.byteLength){
                SOC_log(4, 'SOC_RSA_OAEP.beginVerifySignature', 'Buffer sizes do not match');
                callback_onfinish(false);
            }
            for(let arrayindex in plainuint8){
                if(plainuint8[arrayindex]!==verificationbufferuint8[arrayindex]){
                    SOC_log(4, 'SOC_RSA_OAEP.beginVerifySignature', 'Buffer contents do not match');
                    callback_onfinish(false);
                }
            }
            SOC_log(4, 'SOC_RSA_OAEP.beginVerifySignature', 'Buffer contents match, signature verified');
            callback_onfinish(true);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginVerifySignature', error);
            error_callback(error);
        });
        return true;
    }
    
    /**
     * encrypts data and calls the appropriate callback when done
     * @param {JSONWebKey} publickey_jwk_obj
     * @param {ArrayBuffer} plaintext_buffer
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @param {any|undefined} extra_state_param extra param to pass back to the finished method. needed for async looping
     * @returns {void}
     */
    beginEncrypt(publickey_jwk_obj, plaintext_buffer, callback_onfinish, error_callback, extra_state_param){
        SOC_log(5, 'SOC_RSA_OAEP.beginEncrypt', 'Enter');
        let the_promise = window.crypto.subtle.encrypt(this.encryptDecryptAlgo, publickey_jwk_obj, plaintext_buffer);
        
        the_promise.then(ciphertext_buffer=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginEncrypt', 'Encrypted the data');
            callback_onfinish(ciphertext_buffer, extra_state_param);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginEncrypt', 'Error encrypting the data:' + JSON.stringify(error));
            error_callback(error, extra_state_param);
        });
    }
    /**
     * decrypts data and calls the appropriate callback when done
     * @param {JSONWebKey} privatekey_jwk_obj
     * @param {ArrayBuffer} ciphertext_buffer
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginDecrypt(privatekey_jwk_obj, ciphertext_buffer, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginDecrypt', 'Enter');
        let the_promise = window.crypto.subtle.decrypt(this.encryptDecryptAlgo, privatekey_jwk_obj, ciphertext_buffer);
        
        the_promise.then(plaintext_buffer=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginDecrypt', 'Decrypted the data');
            callback_onfinish(plaintext_buffer);
        }).catch(error=>{
            console.log(error);
            SOC_log(1, 'SOC_RSA_OAEP.beginDecrypt', 'Error decrypting the data:' + JSON.stringify(error));
            error_callback(error);
        });
    }

}   //end of SOC_RSA_OAEP


class SOC_RSASSA_PKCS1_v1_5 extends SOC_Base{
    constructor(){
        super();
        this.algorithm = {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048, 
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: {name: "SHA-256"}
        };
        
        this.signatureAlgo ='RSASSA-PKCS1-v1_5';
    }
    /**
     * generates a new key pair 
     * @param callback_onfinish function(keytype, cryptokey) 
     * @param error_callback function(error) 
     * @returns void
     */
    beginGenerateNewPair(callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair', 'Enter');
        this.error_callback = error_callback;
        
        let usages = ["sign", "verify"];
        let currentinstance = this;
        let generatekeyPromise = window.crypto.subtle.generateKey(this.algorithm, true, usages);
        generatekeyPromise.then(keypair=>{
            currentinstance.generateNewPair_Step_2(currentinstance, callback_onfinish, error_callback, keypair);
        })
        .catch(error=>{
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair', error);
            currentinstance.raiseError('SOC_RSASSA_PKCS1_v1_5:newpair', error);
        });
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair', 'Exit');
    }

    generateNewPair_Step_2(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_2', 'Enter');
        let privatePromise = window.crypto.subtle.exportKey('jwk', keypair.privateKey);
        privatePromise.then(privatejwk=>{
            socglobal_stateobject.privatekey_forsigning = privatejwk; 
            currentinstance.generateNewPair_Step_3(currentinstance, callback_onfinish, error_callback, keypair);
        }).
        catch(privateError=>{
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_2', 'Error exporting the private key=' + privateError);
            currentinstance.raiseError('SOC_RSASSA_PKCS1_v1_5:generateNewPair_Step_2', privateError);
        });
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_2', 'Exit');
    }
    
    generateNewPair_Step_3(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_3', 'Enter');
        let publicPromise = window.crypto.subtle.exportKey('jwk', keypair.publicKey);
        publicPromise.then(publicjwk=>{
            let publickeyjwkstring = JSON.stringify(publicjwk);
            SOC_log(4, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_3', 'New public key:' + publickeyjwkstring);
            socglobal_stateobject.publickey_forsigning = publickeyjwkstring; 
            currentinstance.generateNewPair_Finished(currentinstance, callback_onfinish, error_callback, keypair);
        })
        .catch(publicError=>{
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_3', 'Error exporting the public key=' + publicError);
            currentinstance.raiseError('SOC_RSASSA_PKCS1_v1_5:generateNewPair_Step_3', publicError);
            //callback_onfinish(false);
        });                    
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Step_3', 'Exit');
    }
    
    generateNewPair_Finished(currentinstance, callback_onfinish, error_callback, keypair){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.generateNewPair_Finished', 'Enter');
        callback_onfinish(true);                
    }
   
    /**
     * 
     * @param {JSONWebKey} key_jwk_obj
     * @returns void
     */
    beginImportJwkPrivateKey(key_jwk_obj, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPrivateKey', 'Enter');
        let usages = ["sign"];
        //key_jwk_obj.key_ops = usages;
        let import_promise = window.crypto.subtle.importKey('jwk', key_jwk_obj, this.algorithm, false, usages);
        import_promise.then(cryptokey=>{
            SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPrivateKey', 'Imported the key');
            callback_onfinish(cryptokey);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPrivateKey', 'Error importing the key:' + JSON.stringify(error));
            error_callback(error);
        });
        
    }  
    /**
     * import the signing public key for validating signatures
     * @param {JSON object} publickey_jwk_obj
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginImportJwkPublicKey(publickey_jwk_obj, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPublicKey', 'Enter');
        let usages = ["verify"];
        //key_jwk_obj.key_ops = usages;
        let import_promise = window.crypto.subtle.importKey('jwk', publickey_jwk_obj, this.algorithm, false, usages);
        import_promise.then(cryptokey=>{
            SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPublicKey', 'Imported the key');
            callback_onfinish(cryptokey);
        }).catch(error=>{
            console.log(error);
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.beginImportJwkPublicKey', 'Error importing the key:' + JSON.stringify(error));
            error_callback(error);
        });
        
    }  

    
    /**
     * @param {JSONWebKey} privatekey_jwk_obj
     * @param {string} str_to_be_signed we will only sign already base64 encoded string values
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginSign(privatekey_jwk_obj, str_to_be_signed, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginSign', 'Enter');    
        let txtencoder = new TextEncoder('utf-8');
        let bytes_to_sign = txtencoder.encode(str_to_be_signed);
        window.crypto.subtle.sign(this.signatureAlgo, privatekey_jwk_obj, bytes_to_sign).
                then(signature=>{
                    callback_onfinish(signature);
                }).catch(error=>{
                    error_callback(error);
                });
    }
    
    /**
     * @param {JSONWebKey} publickey_jwk_obj
     * @param {ArrayBuffer} signature_bytes
     * @param {string} str_to_be_signed
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginVerifySignature(publickey_jwk_obj, signature_bytes, str_to_be_signed, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSASSA_PKCS1_v1_5.beginVerifySignature', 'Enter');
        let txtencoder = new TextEncoder('utf-8');
        
        let str_asarraybuffer = txtencoder.encode(str_to_be_signed);
        let the_promise = window.crypto.subtle.verify(this.signatureAlgo, publickey_jwk_obj, signature_bytes, str_asarraybuffer);
        the_promise.then(isverified=>{
            SOC_log(4, 'SOC_RSASSA_PKCS1_v1_5.beginVerifySignature', 'Is verified=' + isverified);
            callback_onfinish(isverified);
        }).catch(error=>{
            console.log(error);
            SOC_log(1, 'SOC_RSASSA_PKCS1_v1_5.beginVerifySignature', error);
            error_callback(error);
        });
    }
    
    /**
     * encrypts data and calls the appropriate callback when done
     * @param {JSONWebKey} publickey_jwk_obj
     * @param {ArrayBuffer} plaintext_buffer
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginEncrypt(publickey_jwk_obj, plaintext_buffer, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginEncrypt', 'Enter');
        let the_promise = window.crypto.subtle.encrypt(this.encryptDecryptAlgo, publickey_jwk_obj, plaintext_buffer);
        
        the_promise.then(ciphertext_buffer=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginEncrypt', 'Encrypted the data');
            callback_onfinish(ciphertext_buffer);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginEncrypt', 'Error encrypting the data:' + JSON.stringify(error));
            error_callback(error);
        });
    }
    /**
     * decrypts data and calls the appropriate callback when done
     * @param {JSONWebKey} privatekey_jwk_obj
     * @param {ArrayBuffer} ciphertext_buffer
     * @param {function} callback_onfinish
     * @param {function} error_callback
     * @returns {void}
     */
    beginDecrypt(privatekey_jwk_obj, ciphertext_buffer, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_RSA_OAEP.beginDecrypt', 'Enter');
        let the_promise = window.crypto.subtle.decrypt(this.encryptDecryptAlgo, privatekey_jwk_obj, ciphertext_buffer);
        
        the_promise.then(plaintext_buffer=>{
            SOC_log(5, 'SOC_RSA_OAEP.beginDecrypt', 'Decrypted the data');
            callback_onfinish(plaintext_buffer);
        }).catch(error=>{
            SOC_log(1, 'SOC_RSA_OAEP.beginDecrypt', 'Error decrypting the data:' + JSON.stringify(error));
            error_callback(error);
        });
    }

}   //end of SOC_RSASSA_PKCS1_v1_5

/**
 * Used to generate a cryptokey based on a password, salt and iteration count
 * used to encrypt private keys
 */
class SOC_PBKDF2 extends SOC_Base{
    /**
     * entry point
     * first create a key from the password
     */
    beginGenerateKey(password_str, salt_str, iterations, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_PBKDF2.generateKey', 'Enter');
        SOC_log(5, 'SOC_PBKDF2.generateKey', 'iterations:' + iterations);
        this.error_callback = error_callback;
        var txtencoder = new TextEncoder('utf-8');
        let password_buffer = txtencoder.encode(password_str);
        let salt_buffer = txtencoder.encode(salt_str);
        // first import the password into a cryptokey
        window.crypto.subtle.importKey('raw', password_buffer, {name: 'PBKDF2'}, false, ['deriveBits', 'deriveKey']).
            then(importedkey=>{
                SOC_log(5, 'SOC_PBKDF2.generateKey', 'Imported key, calling step_2');
                //TODO improve. just adding this here to avoid making more changes after adding a step 2.5 between steps 2 and 3
                socglobal_stateobject.pbdkf2_key_from_password = importedkey;
                //move on to the next step
                this.step_2(importedkey, salt_buffer, iterations, callback_onfinish);
            })
            .catch(error=>{
                SOC_log(1, 'Error at SOC_PBKDF2.generateKey', 'ImportKey error=' + error);
                this.raiseError('SOC_PBKDF2:generateKey', error);
            });
        SOC_log(5, 'SOC_PBKDF2.generateKey', 'Exit');
    }
    
    /**
     * derive the key
     * the key is a 128 bit AES-CBC key
     * @param CyptoKey importedkey
     * @param ArrayBuffer salt_buffer
     * @param int iterations
     * @param function() callback_onfinish
     * @returns void
     */
    step_2(importedkey, salt_buffer, iterations, callback_onfinish){
        SOC_log(1, 'SOC_PBKDF2.step_2', 'Enter');
        window.crypto.subtle.deriveKey(
            { "name": 'PBKDF2', "salt": salt_buffer, "iterations": iterations+100, "hash": 'SHA-256'},
            importedkey,
            { "name": 'AES-CBC', "length": 128 },
            true,
            [ "encrypt", "decrypt" ]
        ).then(derivedkey=>{
            SOC_log(5, 'SOC_PBKDF2.step_2', 'Derived the key, calling finished');            
            //this.step_3(derivedkey, callback_onfinish);
            this.finished(derivedkey, callback_onfinish);
        }            
        )
        .catch(error=>{
                SOC_log(1, 'SOC_PBKDF2.step_2', error);
                this.raiseError('SOC_PBKDF2:step_2', error);
            }
        );        
        SOC_log(5, 'SOC_PBKDF2.step_2', ' Exit');
    }
    
    /**
     * NOT USED AT THE MOMENT. IT JUMPS TO finished FROM step_2
     * now export the derived key
     * @param CryptoKey derivedkey
     * @param function callback_onfinish
     * @returns void
     */
    step_3(derivedkey, callback_onfinish){
        SOC_log(5, 'SOC_PBKDF2.step_3 Enter');
        window.crypto.subtle.exportKey('raw', derivedkey)
        .then(exportedkey=>{
            SOC_log(5, 'SOC_PBKDF2.step_3', 'Exported the generated key, calling finished');
            this.finished(exportedkey, callback_onfinish);
        }
        ).catch(error=>{
                SOC_log(1, 'SOC_PBKDF2.step_3', error);
                this.raiseError('SOC_PBKDF2:step_3', error);
            }
        );
        SOC_log(5, 'SOC_PBKDF2.step_3', 'Exit');
    }

    /**
     * just calls the callback
     * @param CryptoKey exportedkey
     * @param function callback_onfinish
     * @returns void
     */
    finished(exportedkey, callback_onfinish){
        SOC_log(5, 'SOC_PBKDF2.finished', 'Enter');        
        callback_onfinish(exportedkey);
    }
    
    
}   //end of SOC_PBKDF2

/**
 * 
 * just a placeholder for future use
 */
class SOC_AES extends SOC_Base{
}
/**
 * used for decrypting AES encrypted material
 */
class SOC_AES_Decrypt extends SOC_AES{
    
    /**
     * call if you already have the CryptoKey object to be used for decryption
     * @param {string} ciphertext_b64
     * @param {CryptoKey} decryption_cryptokey
     * @param {function} finished_callback
     * @param {function} error_callback
     * @returns {void}
     */
    beginUsingCryptoKey(ciphertext_b64, iv_bytearray, decryption_cryptokey, finished_callback, error_callback){
        SOC_log(5, 'SOC_AES_Decrypt.beginUsingCryptoKey', 'Enter');
        let algo =  {name: "AES-CBC", iv: iv_bytearray};
        
        this.finished(decryption_cryptokey, ciphertext_b64, algo, finished_callback, error_callback);
    }
    
    /**
     * 
     * @param string ciphertext_b64 base64 encoded ciphertext
     * @param ivdata IV bytes
     * @param keydata raw key bytes
     * @param function callback_onfinish which accepts the decrypted data as ArrayBuffer
     * @param function error_callback
     * @returns void
     */
    begin(ciphertext_b64, ivdata, keydata, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_AES_Decrypt.begin', 'Enter');
        //first import the key 
        /*
        let keydata = socglobal_base64.decodeAsByteArray(key_b64);
        SOC_log(5, 'SOC_AES_Decrypt.begin', 'Key length=' + keydata.length);
        let ivdata = socglobal_base64.decodeAsByteArray(iv_b64);
        SOC_log(5, 'SOC_AES_Decrypt.begin', 'IV length=' + ivdata.length);        
        */
        let algo =  {name: "AES-CBC", iv: ivdata};
        
        window.crypto.subtle.importKey('raw', keydata, algo, false, ['decrypt']).
            then(cryptokey=>{
                this.finished(cryptokey, ciphertext_b64, algo, callback_onfinish, error_callback);
            })
            .catch(error=>{
                SOC_log(1, 'SOC_AES_Decrypt.begin', error);
                console.log(error);
                error_callback(error);
            });
        SOC_log(5, 'SOC_AES_Decrypt.begin', 'Exit');
    }

    /**
     * called 
     * @param cryptokey cryptokey
     * @param {type} ciphertext_b64
     * @returns {undefined}
     */
    finished(cryptokey_obj, ciphertext_b64, algo, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_AES_Decrypt.finished', 'Enter'); 
        let ciphertext_bytes = socglobal_base64.decodeAsByteArray(ciphertext_b64);
        window.crypto.subtle.decrypt(algo, cryptokey_obj, ciphertext_bytes).
            then(arrbuff=>{
                callback_onfinish(arrbuff);
            })
            .catch(error=>{
                SOC_log(1, 'SOC_AES_Decrypt.finished', error);
                console.log(error);
                error_callback(error);
            });
        SOC_log(5, 'SOC_AES_Decrypt.finished', 'Exit'); 
    }
}   //End of SOC_AES_Decrypt

/**
 * class for AES encryption
 */
class SOC_AES_Encrypt extends SOC_AES{

    generateKey(finished_callback, error_callback){
        SOC_log(5, 'SOC_AES_Encrypt.generateKey', 'Enter');
        window.crypto.subtle.generateKey(
            {name:'AES-CBC', length:128}, 
            true, 
            ['encrypt','decrypt']
        ).then(generatedkey=>{
            finished_callback(generatedkey);
        }).catch(error=>{
            SOC_log(1, 'SOC_AES_Encrypt.generateKey', error);
            error_callback(error);
        });        
    }
    
    encrypt(thekey, iv_bytearray, input_buffersource, finished_callback, error_callback){
        SOC_log(5, 'SOC_AES_Encrypt.encrypt', 'Enter');
        let algo = {name: "AES-CBC", iv:iv_bytearray};
        window.crypto.subtle.encrypt(algo, thekey, input_buffersource).
        then(ciphertext_buffer=>{
            finished_callback(ciphertext_buffer);
        })
        .catch(error=>{
            SOC_log(1, 'SOC_AES_Encrypt.encrypt', error);
            error_callback(error);
        });
    }
    
    exportKey(thekey, finished_callback, error_callback){
        SOC_log(5, 'SOC_AES_Encrypt.exportKey', 'Enter');
        window.crypto.subtle.exportKey('raw', thekey).
        then(
            exportedkey=>{
                finished_callback(exportedkey);
            }
        )
        .catch(error=>{
            SOC_log(1, 'SOC_AES_Encrypt.exportKey', error);
            error_callback(error);
        });
    }
    
    /**
     * AES-CBC 128 with random key and random IV
     * @param BufferSource input_buffersource
     * @param function callback_onfinish which expects the encrypted byte array, exported auto-generated key and the iv as byte arrays
     * @param function error_callback
     * @returns void
     */
    beginGenerateEncryptExport(input_buffersource, callback_onfinish, error_callback){
        SOC_log(5, 'SOC_AES_Encrypt.beginGenerateEncryptExport', 'Got the key promise');
        this.error_callback = error_callback;
        this.finishedcb = callback_onfinish;
        this.plaintextbuffer = input_buffersource;
        let iv = SOC_getRandomBytes(16);
        this.alg = {name: "AES-CBC", iv};
        this.iv = iv;
        let keyPromise = window.crypto.subtle.generateKey(
            {name:'AES-CBC', length:128}, 
            true, 
            ['encrypt','decrypt']
        );
        SOC_log(5, 'SOC_AES_Encrypt.beginGenerateEncryptExport', 'Got the key promise');
        keyPromise.then(key=>{
            this.step_2(key);
        }).
        catch(error=>{
            SOC_log(5, 'SOC_AES_Encrypt.beginGenerateEncryptExport', 'Error at keyPromise.catch: ' + error);
            this.raiseError('SOC_AES_Encrypt:begin', error);            
        });
        SOC_log(5, 'SOC_AES_Encrypt.beginGenerateEncryptExport', 'Exit');            
    }

    step_2(key){
        SOC_log(5, 'SOC_AES_Encrypt.step_2','Enter');
        let encPromise = window.crypto.subtle.encrypt(this.alg, key, this.plaintextbuffer);    
        encPromise.then(ciphertext_buffer=>{
            SOC_log(5, 'SOC_AES_Encrypt.step_2: Calling step_3 inside encPromise.then');
            this.step_3(ciphertext_buffer, key);
        })
        .catch(encerror=>{
            SOC_log(5, 'SOC_AES_Encrypt.step_2: Error at encPromise.catch: ' + encerror);
            this.raiseError('SOC_AES_Encrypt:step_2', encerror);
        });
        SOC_log(5, 'SOC_AES_Encrypt.step_2', 'Exit');
    }

    step_3(ciphertext_buffer, key){
        SOC_log(5, 'SOC_AES_Encrypt.step_3','Enter');
        window.crypto.subtle.exportKey('raw', key).then(
            exportedkey=>{
                SOC_log(5, 'SOC_AES_Encrypt.step_3', 'exportKey.then called');                
                //soc_encrypt_finished
                this.finished(ciphertext_buffer, exportedkey);
            }
        )
        .catch(error=>{
            SOC_log(1, 'SOC_AES_Encrypt.step_3', error);
            this.raiseError('SOC_AES_Encrypt:step_3', error);
        });
        SOC_log(5, 'SOC_AES_Encrypt.step_3', 'Exit');
    }

    finished(ciphertext_buffer, exportedkey){        
        SOC_log(1, 'SOC_AES_Encrypt.finished','Enter');
        /*        
        let ciphertextb64= this.b64Encode(new Uint8Array(ciphertext_buffer));
        let keyb64= this.b64Encode(new Uint8Array(exportedkey));
        let ivb64 = this.b64Encode(new Uint8Array(this.iv));
        */
        SOC_log(5, 'SOC_AES_Encrypt.finished','Exit');
        this.finishedcb(ciphertext_buffer, this.iv, exportedkey);
    }
}