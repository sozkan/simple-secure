/* 
 * code for #generatekey
 */


/**
 * called when generate new key form is submitted
 * process flow : 
 * - generate new RSA keypair
 * - generate a new PBKDF2 key which will be used to encrypt the RSA private key
 * - encrypt the private key with the pbdkf2 key
 * - put the  private key and some metadata into a json object 
 * - put the  public key and some metadata into a json object 
 * - upload the private key json to google drive
 * - upload the public key json to google drive
 * - enable link sharing (anyone with the link can view) for the public key file
 * @returns void
 */
function SOC_createnewkeypairform_submit(){
    let numiterations = document.forms['createnewkeypairform'].keysecretsform_number.value;
    
    let numiterationsint = parseInt(numiterations);    
    if(numiterationsint<100 || numiterationsint>10000){
        SOC_alert('Enter a number between 100 and 10000');
        return;
    }
    
    let enteredpassword = document.forms['createnewkeypairform'].password.value;
    if(enteredpassword.length<10){
        SOC_alert('Minimum allowed password length is 10. You should use an adequately long string as your password');
        return;        
    }
    let enteredkeyname = document.forms['createnewkeypairform'].name.value;
    if(enteredkeyname.length<1){
        SOC_alert('You must enter a key name, any value will work, try to use a meaningful name');
        return;        
    }
    let createnewkeypairform_submit = SOC_gebi('createnewkeypairform_submit');
    createnewkeypairform_submit.value =' PLEASE WAIT ...';
    createnewkeypairform_submit.disabled = true;
    SOC_log(5,'SOC_createnewkeypairform_submit', 'Enter');
    SOC_updateprogress('info','Starting to create a new key');
    socglobal_stateobject = {};
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    socrsassa.beginGenerateNewPair(SOC_createnewkeypairform_submit_0, SOC_createnewkeypairform_submit_error_cb);
}

function SOC_createnewkeypairform_submit_0(didgeneratesucceed){    
    SOC_log(5,'SOC_createnewkeypairform_submit_0', 'Enter');
    
    if(didgeneratesucceed && socglobal_stateobject.publickey_forsigning && socglobal_stateobject.privatekey_forsigning){
        SOC_updateprogress('info','Generated new signing key pair');
        let socrsaoaep = new SOC_RSA_OAEP();
        socrsaoaep.beginGenerateNewPair(SOC_createnewkeypairform_submit_1, SOC_createnewkeypairform_submit_error_cb);        
    }
    else{
        SOC_log(1,'SOC_createnewkeypairform_submit_0', 'Failed to generate signing keypair');
        SOC_updateprogress('error','Failed to generate new signing key pair. Can\'t continue');
        SOC_alert('Failed to generate signing key pair');
    }
}

/**
 * error callback
 */
function SOC_createnewkeypairform_submit_error_cb(error){
    //TODO improve
    SOC_updateprogress('error','Error generating new key. Error:' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error creating new key. Please see console logs for more details');
    console.log(error);
}
/**
 * callback to be called by SOC_RSA_OAEP
 * socglobal_stateobject.publickey && socglobal_stateobject.privatekey will be already set when this function is called
 * @param {boolean} didgeneratesucceed
 * @returns void
 */
function SOC_createnewkeypairform_submit_1(didgeneratesucceed){
    SOC_log(5,'SOC_createnewkeypairform_submit_1', 'Enter');
    if(didgeneratesucceed && socglobal_stateobject.publickey && socglobal_stateobject.privatekey){
        SOC_updateprogress('info','Generated new encryption key pair');
        //now we can move on to the next step
        let socpbkdf = new SOC_PBKDF2();
        let pwdstr = document.forms['createnewkeypairform'].password.value;
        let saltstr = pwdstr;   //TODO we use the password as the salt as well.        
        
        let numiterations = document.forms['createnewkeypairform'].keysecretsform_number.value;

        socpbkdf.beginGenerateKey(pwdstr, saltstr, numiterations, SOC_createnewkeypairform_submit_2, SOC_createnewkeypairform_submit_error_cb);
    }
    else{
        SOC_updateprogress('error','Failed to generate new encryption key pair');
        SOC_alert('Failed to generate encryption key pair. Please see logs for more details.');
    }
}

/**
 * called from SOC_createnewkeypairform_submit_1 
 * @param {CryptoKey} derivedcryptokey
 * @returns void
 */
function SOC_createnewkeypairform_submit_2(derivedcryptokey){
    SOC_log(5,'SOC_createnewkeypairform_submit_2', 'Enter');
    SOC_updateprogress('info','Generated the symmetric key to be used for encrypting the new key');
    ////this is bad naming. it's actually the AES key derived using pbkdf2
    socglobal_stateobject.pbkdf2Key = derivedcryptokey;
    
    
    ///now we will derive the IV bits using the same derived pbkdf2 cryptokey
    //TODO should not be in the ui.js file
    
    let numiterations = document.forms['createnewkeypairform'].keysecretsform_number.value;
    let salt_buffersource = SOC_get_saltforpbkdf_derivebits(numiterations);
    
    SOC_updateprogress('info','Deriving the initialization vector to be used for encrypting the new key');
    window.crypto.subtle.deriveBits(
    {
        "name": "PBKDF2",
        salt: salt_buffersource, 
        iterations: numiterations,
        hash: {name: "SHA-256"}
    },
        socglobal_stateobject.pbdkf2_key_from_password, 
        128 
    )
    .then(function(derivedbits){
        //this is our IV
        SOC_createnewkeypairform_submit_2_5(derivedbits);
    })
    .catch(function(error){
        console.log(error);
        SOC_log(1, 'Error deriving bits from PBKDF2 key:' + JSON.stringify(error));
    });
}


/**
 * step 2.5 (I had a new call between step 2 and 3 
 * @returns {undefined}
 */
function SOC_createnewkeypairform_submit_2_5(derivediv_frompbkdf2){
    SOC_updateprogress('info','Derived the initialization vector. Starting to encrypt the key (symmetric encryption of the new asymmetric keys)');
        //now encrypt the private key with this key
    //at this stage socglobal_stateobject.privateKey contains the jwk export of the privateKey
    let algo = {"name": "AES-CBC", 'iv': derivediv_frompbkdf2};
    var txtencoder = new TextEncoder('utf-8');    
    /////
    let privatekeys_obj = {
        'encryption' : socglobal_stateobject.privatekey,
        'signing' : socglobal_stateobject.privatekey_forsigning
    } 
    let privatekey_bytes = txtencoder.encode(JSON.stringify(privatekeys_obj));
    //TODO maybe this part should not be in the ui.js file
    window.crypto.subtle.encrypt(algo, socglobal_stateobject.pbkdf2Key, privatekey_bytes).
            then(ciphertextbuffer=>{
                
                let encryptedPKb64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertextbuffer));
                let generatedtime = new Date();
                socglobal_stateobject.generatedtime = generatedtime;
                let privatekeywithmetadata = {
                    'privatekey': encryptedPKb64,
                    'generated': generatedtime,
                    'name': document.forms['createnewkeypairform'].name.value,
                    'publickey': {
                        'encryption': socglobal_base64.encodeString(socglobal_stateobject.publickey),
                        'signing': socglobal_base64.encodeString(socglobal_stateobject.publickey_forsigning),                        
                    }
                };
                let privateKeyJSON = JSON.stringify(privatekeywithmetadata);
                SOC_createnewkeypairform_submit_3(privateKeyJSON);
            }).
            catch(error=>{
                console.log(error);
                SOC_createnewkeypairform_submit_error_cb(error);
            });   
}

/**
 * called from SOC_createnewkeypairform_submit_2_5 after the private keys are AES encrypted
 * @param {string} privatekeyJSON ready to be uploaded to google drive
 * @param {string} publickeyJSON    ready to be uploaded to google drive 
 * @returns {void}
 */
function SOC_createnewkeypairform_submit_3(privatekeyJSON){
    SOC_updateprogress('info','Encrypted the new private key. Saving the key file to Google Drive');
    SOC_log(4, 'SOC_createnewkeypairform_submit_3', 'Enter');
    socglobal_providerclient.savePrivateKey(privatekeyJSON, document.forms['createnewkeypairform'].name.value, SOC_createnewkeypairform_submit_3_privatekey_cb);
}
/**
 * will be called when the private key is saved
 * @returns void
 */
function SOC_createnewkeypairform_submit_3_privatekey_cb(responsefromprovider){
    SOC_log(4, 'SOC_createnewkeypairform_submit_3_privatekey_cb', 'Enter');
    SOC_updateprogress('info','Saved the new private key to Google drive.');

    var createnewkeypairform_saveresultdiv = SOC_gebi('createnewkeypairform_saveresultdiv');
    if(responsefromprovider){
        createnewkeypairform_saveresultdiv.innerHTML = 'New private key file created in your Google Drive: ' + 
                SOC_escapehtml(responsefromprovider.result.name) 
                +' This is your part of the secret. Do NOT share this file with anyone!';
    }
    //now save the public key and share it 
    let publickeywithmetadata = {
        'encryption': socglobal_base64.encodeString(socglobal_stateobject.publickey),
        'signing': socglobal_base64.encodeString(socglobal_stateobject.publickey_forsigning),
        'generated': socglobal_stateobject.generatedtime,
        'email': socglobal_currentuseremail
    };
    let publickeyjson = JSON.stringify(publickeywithmetadata);
    SOC_updateprogress('info','Saving the new public key file to Google drive.');
    socglobal_providerclient.savePublicKey(publickeyjson, document.forms['createnewkeypairform'].name.value, SOC_createnewkeypairform_submit_4);
}
/**
 * will be called when the public key is saved to google drive
 * gets a sharable link for the public key (actually just begins the async call)
 * 
 * @returns {void}
 */
function SOC_createnewkeypairform_submit_4(publickeysave_response){
    SOC_updateprogress('info','Saved the new public key file to Google drive. Updating sharing settings');
    SOC_log(4, 'SOC_createnewkeypairform_submit_4', 'Enter');
    //now get shareable link for the public key
    let fileIdForPublicKey = publickeysave_response.result.id;
    var createnewkeypairform_saveresultdiv = SOC_gebi('createnewkeypairform_saveresultdiv');
    createnewkeypairform_saveresultdiv.innerHTML +='<br>New public key file created in your Google Drive:' + 
            SOC_escapehtml(publickeysave_response.result.name);
    //and shared it with <em>anyone with the link can view</em> mode.'; 
    socglobal_providerclient.sharePublicKeyFile(fileIdForPublicKey, SOC_createnewkeypairform_submit_4_cb);
    
}

/**
 * called after the public key is shared
 * @param {string} publickey_fileId
 * @param {object} permissions_response
 * @returns {void}
 */
function SOC_createnewkeypairform_submit_4_cb(publickey_fileId, permissions_response){
    SOC_log(5,'SOC_createnewkeypairform_submit_4_cb', 'Enter');
    SOC_updateprogress('info','Shared the new public key file');
    var createnewkeypairform_saveresultdiv = SOC_gebi('createnewkeypairform_saveresultdiv');
    if(permissions_response.result.kind=='drive#permission'){
        createnewkeypairform_saveresultdiv.innerHTML +='<br>Shared the new public key file in <em>anyone with the link can view</em> mode.'; 
        //now get the shareable link for the file
        socglobal_providerclient.getSharableLinkForFile(publickey_fileId, SOC_createnewkeypairform_submit_5_cb);
    }
    else{
        createnewkeypairform_saveresultdiv.innerHTML +='<br>Successfully uploaded files but failed to share the public key. You can '+
                                                        'manually share it using Google Drive UI.'; 
    }
}
/**
 * called after the sharable link for the public key is obtained
 * for now, this is the final step of the generate new key pair chain of events
 * @param {string} fileIdForPublicKey
 * @param {object} fileinfo_response
 * @returns {void}
 */
function SOC_createnewkeypairform_submit_5_cb(fileIdForPublicKey, fileinfo_response){
    SOC_updateprogress('info','Completed the new key generation process');
    SOC_log(5, 'SOC_createnewkeypairform_submit_5_cb', 'Enter');
    var createnewkeypairform_saveresultdiv = SOC_gebi('createnewkeypairform_saveresultdiv');
    
    let newhtmlstr = '<br>The public key can be downloaded from the following link. This is the link that you '+
            'can share with your contacts(you can find the same link by opening the file using google drive, '+
            'this is the same link as &quote;Get Sharable Link&quote; for the file)';
    if(fileinfo_response.result.webContentLink){
        newhtmlstr+='<br>Direct download link: <a target="_blank" href="'+fileinfo_response.result.webContentLink+'">'+fileinfo_response.result.webContentLink+'</a>';
    }
    if(fileinfo_response.result.webContentLink){
        newhtmlstr+='<br>Standard google drive share link: <a target="_blank" href="'+fileinfo_response.result.webViewLink+'">'+fileinfo_response.result.webViewLink+'</a>';
    }
    createnewkeypairform_saveresultdiv.innerHTML = createnewkeypairform_saveresultdiv.innerHTML + newhtmlstr;
    
    let createnewkeypairform_submit = SOC_gebi('createnewkeypairform_submit');
    createnewkeypairform_submit.value ='Generate New Key';
    createnewkeypairform_submit.disabled = false;
    
    SOC_gebi('createnewkeypairform').reset();

}


