/**
 * javascript code specific to #mykeys page
 */

/**
 * load and render my existing keys div
 * @returns void
 */
function SOC_myexistingkeypairsdiv_render(){
    SOC_updateprogress('info','Updating my keys list');
    socglobal_providerclient.listMyKeys(SOC_listmykeys_callback);
}


/**
 * renders the list of MY keys in google drive (not contacts keys)
 * @param {object} results
 * @returns {void}
 */
function SOC_listmykeys_callback(results){
    SOC_updateprogress('info','Loaded list of my keys from Google');
    let targetdiv = SOC_gebi('myexistingkeypairs_keyslistdiv');
    if(!results.files || results.files.length<1){
        targetdiv.innerHTML='<div class="informative-msg">You don\'t have any keys. <a href="#generatekey">Click here to create a new key</a></div>';
        return;
    }
    let generatedhtml = '';
    generatedhtml+='<div>';
    socglobal_mykeyslist = new Array();
    for(let tmpfile of results.files){
        socglobal_mykeyslist.push({
            fileId:tmpfile.id,
            fileName:tmpfile.name,
            mimeType:tmpfile.mimeType,
            keyname: tmpfile.properties.keyname,
            webViewLink: tmpfile.webViewLink
        });
        generatedhtml+='<div class="myexistingkeypairs_keysradio_div">';
            generatedhtml+='<label><input type="radio" name="selectedprivatekey" value="'+SOC_escapehtml(tmpfile.id)+'">';
            generatedhtml+=SOC_escapehtml(tmpfile.properties.keyname);
        generatedhtml+='<div class="input-sidenote">File in drive: <a href="'+tmpfile.webViewLink+'" target="_blank">'+SOC_escapehtml(tmpfile.name)+'</a></div>';
        generatedhtml+='</label>';        
        generatedhtml+='</div>';        
   }
    generatedhtml+='</div>';
    
    
    targetdiv.innerHTML = generatedhtml;
}

/**
 * called after selecting a private key to load and submitting that form
 * first we download the private key file 
 */
function SOC_loadmyprivatekey_submit(){
    SOC_log(5, 'SOC_loadmyprivatekey_submit', 'Enter');
    let selectedradio =  document.querySelector('input[name="selectedprivatekey"]:checked');
    if(!(selectedradio && selectedradio.value)){
        SOC_alert('Please select a private key to load');
        return;        
    }
    let privatekeyfileid = selectedradio.value;  
    //redundant?
    if(!privatekeyfileid){
        SOC_alert('Please select a private key to load');
        return;
    }
    let selectprivatekeyandloadform_submit = SOC_gebi('selectprivatekeyandloadform_submit');
    selectprivatekeyandloadform_submit.disabled = true;
    selectprivatekeyandloadform_submit.value ='Loading...';
    SOC_updateprogress('info', 'Downloading my private key file');
    socglobal_providerclient.downloadFile(privatekeyfileid, SOC_loadmyprivatekey_submit_2, SOC_loadmyprivatekey_submit_error_cb);
}
/**
 * called when the private key file is downloaded successfully from google drive
 * @param {string} fileId
 * @param {object} download_response the response from google drive
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_2(fileId, download_response){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_2', 'Enter');
    if(!download_response || !download_response.result){
        SOC_updateprogress('info', 'Failed to download my private key file');
        SOC_loadmyprivatekey_submit_error_cb('Error downloading private key file, please try again');
        return;
    }
    SOC_updateprogress('info', 'Downloaded my private key file. Starting to create the key to be used for decrypting the private key');
    //we will use this in the next step
    socglobal_stateobject.myprivatekey_encrypted = download_response.result.privatekey;
    socglobal_stateobject.mypublickeys_json_obj = download_response.result.publickey;
    //TODO investigate: Google api breaks unicode characters in files due to encoding problems
    socglobal_stateobject.mycurrentloadedkey_name =  decodeURIComponent(escape(download_response.result.name));
    socglobal_stateobject.mycurrentloadedkey_generated = download_response.result.generated;
    //first generate the pbkdf key that will be used to decrypt the key file 
    let keypassword = document.forms['selectprivatekeyandloadform'].password.value;
    let saltstr = keypassword;
    let selectednumber = document.forms['selectprivatekeyandloadform'].keysecretsform_number.value;
    let socpbkdf = new SOC_PBKDF2();
    socpbkdf.beginGenerateKey(keypassword, saltstr, selectednumber, SOC_loadmyprivatekey_submit_2_5, SOC_loadmyprivatekey_submit_error_cb);
    
}
/**
 * generate the IV by calling deriveBits
 * @param {CryptoKey} cryptokey_frompbkdf this is the generated AES cryptokey not the PBKDF2 cryptokey
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_2_5(cryptokey_frompbkdf){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_2_5', 'Enter');
    SOC_updateprogress('info','Generating the initialization vector to be used for decrypting my private key');
    socglobal_stateobject.aes_cryptokey_frompbkdf = cryptokey_frompbkdf;

    let numiterations = document.forms['selectprivatekeyandloadform'].keysecretsform_number.value;
    let salt_buffersource = SOC_get_saltforpbkdf_derivebits(numiterations);
    
    window.crypto.subtle.deriveBits(
    {
        "name": "PBKDF2",
        salt: salt_buffersource, //using a constant salt buffer
        iterations: numiterations,
        hash: {name: "SHA-256"}
    },
        socglobal_stateobject.pbdkf2_key_from_password, 
        128 
    )
    .then(function(derivedbits){
        //this is our IV
        SOC_log(4, 'SOC_loadmyprivatekey_submit_2_5', 'Derived IV using PBKDF2');
        SOC_updateprogress('info','Generated the initialization vector to be used for decrypting my private key');
        SOC_loadmyprivatekey_submit_3(derivedbits);
    })
    .catch(function(error){
        console.log(error);
        SOC_log(1, 'Error deriving bits from PBKDF2 key:' + SOC_escapehtml(JSON.stringify(error)));
    });
}

/**
 * called after a pbkdf cryptokey is generated
 * now decrypt the private key using the generated cryptokey
 * at this stage socglobal_stateobject.myprivatekey_encrypted should contain the base64 encoded encrypted private key
 * decrypting the key will give us the private key jwk that we will import 
 * @param {CryptoKey} cryptokey_frompbkdf
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_3(derivediv_frompbkdf){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_3', 'Enter');
    SOC_updateprogress('info','Decrypting my private key');    
    
    let socaes = new SOC_AES_Decrypt();
    socaes.beginUsingCryptoKey(socglobal_stateobject.myprivatekey_encrypted, derivediv_frompbkdf, socglobal_stateobject.aes_cryptokey_frompbkdf , 
                                SOC_loadmyprivatekey_submit_4, SOC_loadmyprivatekey_submit_3_error_cb);
    
}
/**
 * called when AES decryption of the private key fails. 
 * probably due to incorrect password or number
 * @param {type} error_fromaesdecrypt
 * @returns {undefined}
 */
function SOC_loadmyprivatekey_submit_3_error_cb(error_fromaesdecrypt){
    SOC_updateprogress('error', 'AES decryption of the private keys failed. Make sure that you entered the correct password and the correct number. Error:' + 
                                    SOC_escapehtml(JSON.stringify(error_fromaesdecrypt)));
    SOC_alert('Decryption failed. Check the password and selected number');
    SOC_selectprivatekeyandloadform_reset();
    //SOC_loadmyprivatekey_submit_error_cb
}
/**
 * called after the private key is decrypted using the AES key
 * @param {ArrayBuffer} decrypted_buffer
 * @returns {undefined}
 */
function SOC_loadmyprivatekey_submit_4(decrypted_buffer){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_4', 'Enter');
    //TODO it may not be cleared in all code paths    
    socglobal_stateobject.myprivatekey_encrypted='';
    if(!decrypted_buffer){
        SOC_updateprogress('warn','Failed to decrypt my private key. Check your password and selected number');
        SOC_loadmyprivatekey_submit_error_cb('Could not decrypt the private key, this is unexpected');
        return;
    }
    let txtdecoder = new TextDecoder('utf-8');
    let privatekeyjwk = txtdecoder.decode(decrypted_buffer);
    /*
    if(!privatekeyjwk.startsWith('{')){
        privatekeyjwk = privatekeyjwk.substring(16);
    }
    */
    SOC_updateprogress('info','Decrypted my private key. Importing it now');
    let privatekeyjwk_obj = JSON.parse(privatekeyjwk);
    let socrsa = new SOC_RSA_OAEP();
    socglobal_stateobject.signing_private_key = privatekeyjwk_obj.signing;
    socrsa.beginImportJwkPrivateKey(privatekeyjwk_obj.encryption, SOC_loadmyprivatekey_submit_5, SOC_loadmyprivatekey_submit_error_cb);
    SOC_log(5, 'SOC_loadmyprivatekey_submit_4', 'Exit');
}

/**
 * called after importing my RSA key for encryption
 * @param {CryptoKey} imported_cryptokey this is the encryption RSA key
 * @returns {undefined}
 */
function SOC_loadmyprivatekey_submit_5(imported_cryptokey){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_5', 'Enter');
    SOC_updateprogress('info','Decrypted my private key for encryption. Starting to import the one for signing');
    socglobal_myprivatekey = imported_cryptokey;
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    socrsassa.beginImportJwkPrivateKey(socglobal_stateobject.signing_private_key, SOC_loadmyprivatekey_submit_6, SOC_loadmyprivatekey_submit_error_cb);
    socglobal_stateobject.signing_private_key = null;
    SOC_log(5, 'SOC_loadmyprivatekey_submit_5', 'Exit');
}
/**
 * called after importing the signing private key
 * @param {CryptoKey} imported_signing_key
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_6(imported_signing_key){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_6', 'Enter');
    SOC_updateprogress('info','Imported my private key for signing. Starting to import my public key for signing');
    socglobal_myprivatekey_forsigning = imported_signing_key;
    //now import the signing public key    
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    
    let signingpublickey_str = socglobal_base64.decodeAsString(socglobal_stateobject.mypublickeys_json_obj.signing);
    
    let signingpublickey_json_obj = JSON.parse(signingpublickey_str);
    socrsassa.beginImportJwkPublicKey(signingpublickey_json_obj, SOC_loadmyprivatekey_submit_7, SOC_loadmyprivatekey_submit_error_cb);
    
}
/**
 * Imported my signing public key
 * now we will calculate the hash and checksum for the public key so that we can tell others what 
 * the checksum for our key is
 * @param {CryptoKey} imported_public_key
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_7(imported_public_key){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_7', 'Enter');
    SOC_updateprogress('info','Loaded my public key. Now calculating checksums for my public key.');
    socglobal_mypublickey_forverifying = imported_public_key;
    //////////
    let strtohash = socglobal_stateobject.mypublickeys_json_obj.encryption + socglobal_stateobject.mypublickeys_json_obj.signing;
    SOC_sha256(strtohash, SOC_loadmyprivatekey_submit_8, SOC_loadmyprivatekey_submit_error_cb);
}


/**
 * called after the sha256 hash for the imported key file is calculated
 * note that it does not end here, we are now going to load the public key 
 * for encryption
 * @param {CryptoKey} imported_public_key
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_8(publickeys_sha256hash_bytes){
    SOC_log(5, 'SOC_loadmyprivatekey_submit_8', 'Enter');
    let publickeycheckinfo = SOC_sha256_to_manualcheckvalues(publickeys_sha256hash_bytes);
    
    let targetdiv = SOC_gebi('currentloadedkeyinfodiv');
    let htmlstr =   ' <span id="currentloadedkeyinfo_namespan" onclick="SOC_showhide_currentkey_details()">Current Key:<b>'+SOC_escapehtml(socglobal_stateobject.mycurrentloadedkey_name)+'</b> <sup>(click for details)</sup></span>'+ 
                    ' <div id="currentloadedkeyinfo_details"><span>Generated: '+SOC_escapehtml(socglobal_stateobject.mycurrentloadedkey_generated)+ '</span>'+
                    ' <span>Checksum 1: ' + publickeycheckinfo.checksum +'</span> '+
                    ' <span>Checksum 2: '+publickeycheckinfo.foursum+'</span> '+
                    ' <span class="sha256hash"><b>Hash:</b> <span>'+ publickeycheckinfo.hash.join('</span> <span>')+'</span></span></div>';
    targetdiv.innerHTML = htmlstr;
    
    //now base64 decode my encryption public key and import it. this key will be used to encrypt files
    let encryptionpublickey_str = socglobal_base64.decodeAsString(socglobal_stateobject.mypublickeys_json_obj.encryption);    
    let encryptionpublickey_json_obj = JSON.parse(encryptionpublickey_str);
    let socrsaoaep = new SOC_RSA_OAEP();
    socrsaoaep.beginImportJwkPublicKey(encryptionpublickey_json_obj, SOC_loadmyprivatekey_submit_9, SOC_loadmyprivatekey_submit_error_cb);
        
}
/**
 * finally all keys are loaded
 * @param {CryptoKey} imported_enryption_publickey
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_9(imported_enryption_publickey){
    //resetting state?? 
    socglobal_stateobject = {};
    SOC_selectprivatekeyandloadform_reset();    
    socglobal_mypublickey_forencryption = imported_enryption_publickey;
    SOC_updateprogress('info','Finished loading all required keys. Ready to send or read secure emails and files.');    
    SOC_alert('Loaded my keys. Ready to send/read emails or read/write files.');
    
}

/**
 * resets the form at the end of the loading process
 * @returns {undefined}
 */
function SOC_selectprivatekeyandloadform_reset(){
    SOC_gebi('selectprivatekeyandloadform').reset();
    let selectprivatekeyandloadform_submit = SOC_gebi('selectprivatekeyandloadform_submit');
    selectprivatekeyandloadform_submit.value='Load Selected Key';
    selectprivatekeyandloadform_submit.disabled = false;    
}

/**
 * 
 * @param {type} error
 * @returns {void}
 */
function SOC_loadmyprivatekey_submit_error_cb(error){
    let logstr = SOC_escapehtml(JSON.stringify(error));
    SOC_log(5, 'SOC_loadmyprivatekey_submit_error_cb', 'Enter. Error:' + logstr);
    SOC_updateprogress('error','Error loading my key. Error:' + logstr);
    //TODO it may not be cleared in all code paths
    socglobal_stateobject.myprivatekey_encrypted='';
    SOC_selectprivatekeyandloadform_reset();
    SOC_alert('Error loading my key. Please see logs for more details.');
}

/**
 * shows or hides the current key details div
 */
function SOC_showhide_currentkey_details(){
    let thediv = SOC_gebi('currentloadedkeyinfo_details');
    if(thediv.style.display=='none'){
        thediv.style.display='inline-block';
    }
    else{
        thediv.style.display='none';
    }
}