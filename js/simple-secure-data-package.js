/*
 * normally I would add secured content and attachments to a zip file to create the secured content package
 * BUT I didn't want to add a huge javascript zip library to the project
 * so, although it will lead to obviously larger secured data package sizes
 * for now I'm going to use JSON and attachment file (which contains secured data) 
 * will be named simple-secure.data
 * signature file will be named simple-secure.signature
 * 
 */

/**
 * 
 * 
 */
var socglobal_datapackage={};
var socglobal_datapackage_data={};
var socglobal_datapackage_state={};

/**
 * resets state stored in global variables
 * @returns {void}
 */
function SOC_datapackage_init(){
    socglobal_datapackage={};
    socglobal_datapackage_data={};
    socglobal_datapackage_state={};
    socglobal_datapackage_state.errors=[];
    socglobal_datapackage_state.current_attachment_index =0;
    socglobal_datapackage_state.total_attachment_count =0;
    socglobal_datapackage_state.attachments_to_be_processed = [];

    socglobal_datapackage_data.attachments = {};  //name:base64DataUrl encoded file contents
        
    socglobal_datapackage.keys = {}; //'email address':base64 encoded (the aes key encrypted with the recipients public key). one entry for each recipient
    socglobal_datapackage.ivs = {}; //'email address':base64 encoded (the random IV encrypted with the recipients public key). one entry for each recipient
    socglobal_datapackage_data.message = '';  //plaintext msg
}    
    
function SOC_datapackage_addmessage(plaintext_msg_str){
    socglobal_datapackage_data.message = plaintext_msg_str; 
}
/**
 * due to the async nature of FileReader we will read 
 * attachment files one by one
 * @returns {void}
 */
function SOC_datapackage_addattachment_array(files_fromfileinputs, finished_callback, error_callback){
    SOC_log(5,'SOC_datapackage_addattachment_array','Enter');
    if(!files_fromfileinputs || files_fromfileinputs.length<1){
        SOC_updateprogress('info', 'No attachments were added to the message');
        finished_callback();
        return;
    }
    SOC_updateprogress('info', files_fromfileinputs.length+' attachments will be added to the message');
    socglobal_datapackage_state.total_attachment_count = files_fromfileinputs.length;
    socglobal_datapackage_state.current_attachment_index = 0 ;
    socglobal_datapackage_state.attachments_to_be_processed = files_fromfileinputs;
    socglobal_datapackage_state.attachments_finished_callback = finished_callback;
    //not used at the moment but adding it for future use
    socglobal_datapackage_state.attachments_error_callback = error_callback;
    SOC_datapackage_addattachment();
}

function SOC_datapackage_addattachment(){
    SOC_log(5,'SOC_datapackage_addattachment','Enter');
    if(!(socglobal_datapackage_state.current_attachment_index<socglobal_datapackage_state.total_attachment_count)){
        SOC_log(4,'SOC_datapackage_addattachment','Processed '+socglobal_datapackage_state.current_attachment_index+' attachments. No more attachments to process.');
        socglobal_datapackage_state.attachments_finished_callback();
        return; //there is nothing to process
    }
    let file_fromfileinput = socglobal_datapackage_state.attachments_to_be_processed[socglobal_datapackage_state.current_attachment_index];
    socglobal_datapackage_state.current_attachment_index++;
    SOC_updateprogress('info', 'Adding attachment \''+SOC_escapehtml(file_fromfileinput.name)+'\'');
    let filereader = new FileReader();
    filereader.addEventListener('load', SOC_datapackage_addattachment_success);
    filereader.addEventListener('error', SOC_datapackage_addattachment_error);
    filereader.readAsDataURL(file_fromfileinput);
    socglobal_datapackage_data.attachments[file_fromfileinput.name] = '';
    socglobal_datapackage_state.current_filename = file_fromfileinput.name;
}
    
function SOC_datapackage_addattachment_success(filereader_event){
    SOC_log(5,'SOC_datapackage_addattachment_success','Enter');
    socglobal_datapackage_data.attachments[socglobal_datapackage_state.current_filename] = filereader_event.srcElement.result;
    SOC_log(5,'SOC_datapackage_addattachment_success',socglobal_datapackage_state.current_filename+'='+filereader_event.srcElement.result);
    SOC_datapackage_addattachment();    //process remaining attachments if any
}
function SOC_datapackage_addattachment_error(filereader_event){
    SOC_updateprogress('error', 'Error adding attachment \''+SOC_escapehtml(filereader_event)+'\'');
    SOC_log(1, 'SOC_datapackage_addattachment_error', filereader_event);

    socglobal_datapackage_state.errors.push(filereader_event);
    SOC_datapackage_addattachment();    //process remaining attachments if any
}

function SOC_datapackage_encrypt(socaes_encrypt, aescryptokey, finished_callback, error_callback){
    SOC_updateprogress('info', 'Starting to encrypt the secure message package');
    SOC_log(5, 'SOC_datapackage_encrypt', 'Enter');
    socglobal_datapackage_state.finished_callback = finished_callback;
    socglobal_datapackage_state.error_callback = error_callback;
    socglobal_datapackage_state.rawiv = SOC_getRandomBytes(16);
    socglobal_datapackage_state.aescryptokey = aescryptokey;
    socglobal_datapackage_state.socaes_encrypt = socaes_encrypt;
    
    let dataasjsonstr = JSON.stringify(socglobal_datapackage_data);

    let txtencoder = new TextEncoder('utf-8');
    let datajson_bytes = txtencoder.encode(dataasjsonstr);
    //encrypt(thekey, iv_bytearray, input_buffersource, finished_callback, error_callback){
    socaes_encrypt.encrypt(aescryptokey, socglobal_datapackage_state.rawiv, datajson_bytes, SOC_datapackage_encrypt_2, SOC_datapackage_encrypt_error_cb);
    SOC_log(5, 'SOC_datapackage_encrypt', 'Exit');
}

/**
 * called after the sensitive data is encrypted (attachments and message)
 * now export the aes key and encrypt the key and the iv using private keys of all recipients
 * base64 encode them and add them to keys and ivs 
 * @param {ArrayBuffer} ciphertext_buffer
 * @returns {void}
 */
function SOC_datapackage_encrypt_2(ciphertext_buffer){
    SOC_log(5, 'SOC_datapackage_encrypt_2', 'Enter');
    SOC_updateprogress('info', 'Encrypted the secure message package, exporting session key');
    let ciphertext_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    socglobal_datapackage.data = ciphertext_b64;    //this is the actual content : message + attachments
    socglobal_datapackage_state.socaes_encrypt.exportKey(socglobal_datapackage_state.aescryptokey, SOC_datapackage_encrypt_3, SOC_datapackage_encrypt_error_cb);
}
/**
 * called after the aes key is exported
 * @param {ArrayBuffer} exportedaeskey_rawbytes
 * @returns {void}
 */
function SOC_datapackage_encrypt_3(exportedaeskey_rawbytes){
    SOC_log(5, 'SOC_datapackage_encrypt_3', 'Enter');
    SOC_updateprogress('info', 'Starting to encrypt the session key for recipients');
    socglobal_datapackage_state.processed_publickey_counter = 0;
    for(let tmpemail in socglobal_composestate.recipients){
        SOC_log(5, 'SOC_datapackage_encrypt_3', 'Starting to process '+tmpemail);
        let tmppublickey = socglobal_composestate.recipients[tmpemail];
        let socrsaoaep = new SOC_RSA_OAEP();
        socrsaoaep.beginEncrypt(tmppublickey, exportedaeskey_rawbytes, SOC_datapackage_encrypt_4, SOC_datapackage_encrypt_error_cb_4, tmpemail);
    }
}

/**
 * this will be called as many times as number of recipients minus number of errors
 */
function SOC_datapackage_encrypt_4(ciphertext_buffer, emailaddress){
    SOC_log(5, 'SOC_datapackage_encrypt_4', 'Enter for '+emailaddress);
    SOC_updateprogress('info', 'Encrypted the session key for ' + SOC_escapehtml(emailaddress));
    socglobal_datapackage.keys[emailaddress] = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    socglobal_datapackage_state.processed_publickey_counter = socglobal_datapackage_state.processed_publickey_counter +1;
    if(socglobal_datapackage_state.processed_publickey_counter==Object.keys(socglobal_composestate.recipients).length){
        SOC_log(5, 'SOC_datapackage_encrypt_4', emailaddress+' counter=' + socglobal_datapackage_state.processed_publickey_counter);
        SOC_datapackage_encrypt_5();
    }
}

function SOC_datapackage_encrypt_error_cb_4(error, emailaddress){
    SOC_log(5, 'SOC_datapackage_encrypt_error_cb_4', 'Enter');
    SOC_updateprogress('error', 'Error encrypting the session key for ' + SOC_escapehtml(emailaddress));
    socglobal_datapackage_state.errors.push(emailaddress+':'+JSON.stringify(error));
    socglobal_datapackage.keys[emailaddress] = '';
    socglobal_datapackage_state.processed_publickey_counter = socglobal_datapackage_state.processed_publickey_counter +1;
    if(socglobal_datapackage_state.processed_publickey_counter==Object.keys(socglobal_composestate.recipients).length){
        SOC_log(5, 'SOC_datapackage_encrypt_error_cb_4', emailaddress+' counter=' + socglobal_datapackage_state.processed_publickey_counter);
        SOC_datapackage_encrypt_5();
    }
}

/**
 * now encrypt IVs using each recipient public key
 * @returns {void}
 */
function SOC_datapackage_encrypt_5(){
    SOC_log(5, 'SOC_datapackage_encrypt_5', 'Enter');
    SOC_updateprogress('info', 'Starting to encrypt the random IV for each recipient');
    socglobal_datapackage_state.processed_iv_counter = 0;
    for(let tmpemail in socglobal_composestate.recipients){
        SOC_log(5, 'SOC_datapackage_encrypt_5', 'Starting for '+tmpemail);
        let tmppublickey = socglobal_composestate.recipients[tmpemail];
        let socrsaoaep = new SOC_RSA_OAEP();
        socrsaoaep.beginEncrypt(tmppublickey, socglobal_datapackage_state.rawiv, SOC_datapackage_encrypt_6, SOC_datapackage_encrypt_error_cb, tmpemail);
    }    
}
function SOC_datapackage_encrypt_6(ciphertext_buffer, emailaddress){
    SOC_log(5, 'SOC_datapackage_encrypt_6', 'Enter');
    SOC_updateprogress('info', 'Encrypted the random IV for '+SOC_escapehtml(emailaddress));
    socglobal_datapackage.ivs[emailaddress] = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    socglobal_datapackage_state.processed_iv_counter = socglobal_datapackage_state.processed_iv_counter +1;
    if(socglobal_datapackage_state.processed_iv_counter==Object.keys(socglobal_composestate.recipients).length){
        SOC_log(5, 'SOC_datapackage_encrypt_6', emailaddress+' counter='+socglobal_datapackage_state.processed_iv_counter);
        SOC_datapackage_encrypt_7();
    }
}

function SOC_datapackage_encrypt_error_cb_6(error, emailaddress){
    SOC_log(5, 'SOC_datapackage_encrypt_error_cb_6', 'Enter');
    SOC_updateprogress('error', 'Error encrypting the random IV for '+SOC_escapehtml(emailaddress));
    socglobal_datapackage_state.errors.push(emailaddress+':'+JSON.stringify(error));
    socglobal_datapackage.ivs[emailaddress] = '';
    socglobal_datapackage_state.processed_iv_counter = socglobal_datapackage_state.processed_iv_counter +1;
    if(socglobal_datapackage_state.processed_iv_counter==Object.keys(socglobal_composestate.recipients).length){
        SOC_log(5, 'SOC_datapackage_encrypt_error_cb_6', emailaddress+' counter='+socglobal_datapackage_state.processed_iv_counter);
        SOC_datapackage_encrypt_7();
    }
}
/**
 * called after all async iv and key encryption loops are finished
 * at this state we have everything . data, keys and ivs
 * now we can convert socglobal_datapackage into json and then base64 encode it and 
 * then sign it 
 * @returns {void}
 */
function SOC_datapackage_encrypt_7(){
    SOC_log(5, 'SOC_datapackage_encrypt_7', 'Enter');
    SOC_updateprogress('info', 'Creating and signing the final simple-secure message package');
    let dataasjson_str = JSON.stringify(socglobal_datapackage);
        
    let datajson_b64 = socglobal_base64.encodeString(dataasjson_str);
    socglobal_datapackage_state.finalb64encodeddata = datajson_b64;
        
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    socrsassa.beginSign(socglobal_myprivatekey_forsigning, datajson_b64, SOC_datapackage_encrypt_8, SOC_datapackage_encrypt_error_cb);
}

/**
 * called after the data is signed
 * this is the end of the process
 * call socglobal_datapackage_state.finished_callback  and pass the signature(b64encoded) and data(b64encoded)
 * @param {ArrayBuffer} signature_bytes
 * @returns {void}
 */
function SOC_datapackage_encrypt_8(signature_bytes){
    SOC_log(5, 'SOC_datapackage_encrypt_8', 'Enter');
    SOC_updateprogress('info', 'Finished signing the final simple-secure message package');
    let signature_b64_str  = socglobal_base64.encodeBytes(new Uint8Array(signature_bytes));
    socglobal_datapackage_state.finished_callback(socglobal_datapackage_state.finalb64encodeddata, signature_b64_str, socglobal_datapackage_state.errors); 
}
/**
 * called in case of an error
 * @param {any} error
 * @returns {void}
 */
function SOC_datapackage_encrypt_error_cb(error){
    SOC_log(5, 'SOC_datapackage_encrypt_error_cb', 'Enter');
    socglobal_datapackage_state.errors.push(JSON.stringify(error));
}
