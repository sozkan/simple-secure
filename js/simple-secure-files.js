/* 
 * code for google drive files
 */

/**
 * cleans up temporary state
 * revokes blob urls and empties signature status fields
 * @returns {void}
 */
function SOC_files_cleanup_state(){
    if(socglobal_files_state && socglobal_files_state.tmp_blob_urls){
        for(let tmpbloburltodelete of socglobal_files_state.tmp_blob_urls){
            window.URL.revokeObjectURL(tmpbloburltodelete);
        }
    }
    SOC_files_editbinaryfileform_reset();
    SOC_files_edittextfileform_reset();
}

/**
 * file filter form is submitted
 * @returns {void}
 */
function SOC_files_filterform_submit(){
    SOC_updateprogress('info', 'Starting to search for files');
    let filter_str = SOC_gebi('filesfilterinput').value;
    socglobal_providerclient.searchFilesInDrive(filter_str, SOC_files_search_finished_cb, SOC_files_search_error_cb);
    
}

/**
 * called when file search is completed
 * @param {Object} responsefrom_provider
 * @returns {void}
 */
function SOC_files_search_finished_cb(responsefrom_provider){
    let fileslistdiv = SOC_gebi('fileslistdiv');
    SOC_updateprogress('info', 'File search finished');
    
    if(responsefrom_provider && responsefrom_provider.result && responsefrom_provider.result.files){
        if(responsefrom_provider.result.files.length<1){
            fileslistdiv.innerHTML='Could not find any files matching the filter';
            SOC_updateprogress('info', 'File search returned no encryted files');
        }
        else{
            SOC_updateprogress('info', 'File search returned '+responsefrom_provider.result.files.length+' results');
            fileslistdiv.innerHTML = '';
            for(let tmpfile of responsefrom_provider.result.files){
                //files(name,id, createdTime, modifiedTime, trashed, starred, properties(originalMimeType),webViewLink, webContentLink)
                let tmpfilecontainerdiv = document.createElement('div');
                tmpfilecontainerdiv.setAttribute('class','file-item-div');
                tmpfilecontainerdiv.addEventListener('click', function(){
                                                            SOC_files_loadfile(tmpfile.id, tmpfile.name, tmpfile.properties.originalMimeType);
                                                        }
                                                );

                let tmpfilenamediv = document.createElement('div');
                tmpfilenamediv.setAttribute('class', 'file-name');
                let tmpfilenametxt = document.createTextNode(tmpfile.name);
                tmpfilenamediv.appendChild(tmpfilenametxt);                
                tmpfilecontainerdiv.appendChild(tmpfilenamediv);
                
                
                let tmpfilepropertiesdiv_html = '<div class="file-property">Created: '+tmpfile.createdTime+'</div>'+
                        '<div class="file-property">Modified: '+tmpfile.modifiedTime+'</div>';
                if(tmpfile.trashed){
                    tmpfilepropertiesdiv_html+='<div class="file-property">(Trashed)</div>';
                }
                if(tmpfile.starred){
                    tmpfilepropertiesdiv_html+='<div class="file-property">(Starred)</div>';
                }
                let tmpfilepropertiesdiv = document.createElement('div');
                tmpfilepropertiesdiv.setAttribute('class', 'file-properties');                
                tmpfilepropertiesdiv.innerHTML = tmpfilepropertiesdiv_html;
                tmpfilecontainerdiv.appendChild(tmpfilepropertiesdiv);
                fileslistdiv.appendChild(tmpfilecontainerdiv);
            }
        }
    }
    else{
        SOC_updateprogress('error', 'Unexpected response from Google drive : '+SOC_escapehtml(JSON.stringify(responsefrom_provider)));
        SOC_alert('Unexpected response from Google drive. Check logs for more details');
    }
}
/**
 * called when an error occurs during file search
 * @param {Object} responsefrom_provider
 * @returns {void}
 */
function SOC_files_search_error_cb(responsefrom_provider){
    SOC_updateprogress('error','Error during file search. See logs for more details');
    SOC_log(1,'SOC_files_search_error_cb', SOC_escapehtml(JSON.stringify(responsefrom_provider)));
}
/**
 * called when a file is clicked 
 * resets forms and starts loading the file
 * @param {string} fileid
 * @param {string} filename
 * @param {string} originalmimetype
 * @returns {void}
 */
function SOC_files_loadfile(fileid, filename, originalmimetype){
    SOC_updateprogress('info','Starting to download file \''+SOC_escapehtml(filename)+'\'');
    SOC_files_cleanup_state();
    if(!socglobal_files_state.files_fileid_mimetype_map){
        socglobal_files_state.files_fileid_mimetype_map = {};
    }
    socglobal_files_state.current_file_id = fileid;
    socglobal_files_state.files_fileid_mimetype_map[fileid] = {'filename': filename, 'originalmimetype':originalmimetype};
    socglobal_providerclient.downloadFile(fileid, SOC_files_loadfile_cb, SOC_files_loadfile_error_cb);
    
    if(originalmimetype && originalmimetype=='text/plain'){
        SOC_files_edittextfileform_reset();
        window.location.hash = '#edittextfile';
    }
    else{
        SOC_files_editbinaryfileform_reset();
        window.location.hash = '#editbinaryfile';
    }
}
/**
 * called when a file is downloaded from google drive
 * @param {string} fileid
 * @param {Object} response_fromprovider
 * @returns {void}
 */
function SOC_files_loadfile_cb(fileid, response_fromprovider){
    SOC_updateprogress('info','Done downloading the file');
    
    if(response_fromprovider.result){
        socglobal_files_state.file_data_result = response_fromprovider.result;    
        /////////first check the signature. 
        if(socglobal_files_state.file_data_result.signature){
            if(socglobal_files_state.file_data_result.signature.signer == socglobal_currentuseremail){
                //I signed it. verify using my current key
                SOC_updateprogress('info','The file was signed by me, will verify the signature using my own key');
                SOC_files_loadfile_verify_signature(socglobal_mypublickey_forverifying);
            }
            else{
                SOC_updateprogress('info','The file was signed by someone else, will download the contact\'s key and verify the signature using that key');
                ///someone else signed it. download the contact file and validate my signature on the contact file
                ///if it's valid. use the contact's key to validate the signature on the file 
                let fileid_for_contact = socglobal_mycontactslist[socglobal_files_state.file_data_result.signature.signer];
                    SOC_log(4, 'SOC_files_loadfile_cb', 'File id for contact=' + fileid_for_contact);
                    socglobal_providerclient.downloadFile(fileid_for_contact, 
                                                            SOC_files_loadfile_contact_file_loaded_cb, 
                                                            SOC_files_loadfile_contact_file_loaded_error_cb);
                
            }
        }

        SOC_gebi('edittextfileform_fileid').value = fileid;
        SOC_gebi('edittextfileform_filename').value = socglobal_files_state.files_fileid_mimetype_map[fileid].filename;    
    }
    else{
        SOC_updateprogress('error','File download failed in a very unexpected way. Error:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
    }
}
/**
 * called when the signature verification for a contact is completed
 * @param {boolean} isverified
 * @returns {void}
 */
function SOC_files_loadfile_contact_file_signatureverified_cb(isverified){
    if(isverified){
        SOC_updateprogress('info', 'Verified my signature on the contact file. Will verify the signature on the file using this contact key');
        let contactpublicsigningkey_json = socglobal_base64.decodeAsString(socglobal_files_state.contact_keyfile_json.signing);

        let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
        let contactpublickey_json_obj = JSON.parse(contactpublicsigningkey_json);
        socrsassa.beginImportJwkPublicKey(contactpublickey_json_obj, 
                                            SOC_files_loadfile_contact_keyimported_cb, 
                                            SOC_files_loadfile_contact_keyimported_error_cb);

    }
    else{
        SOC_updateprogress('error', 'Failed to verify my own signature on the contact key file(not this file). File signature cannot be verified using this contact key as it cannot be trsuted');
        SOC_alert('Failed to verify my signature on the contact key file. File signature cannot be verified');
    }
}

/**
 * called after a contact's key is imported
 * @param {CryptoKey} importedcryptokey
 * @returns {void}
 */
function SOC_files_loadfile_contact_keyimported_cb(importedcryptokey){
    SOC_updateprogress('info', 'Finished importing the contacts key, ready to use it to verify the signature');
    SOC_files_loadfile_verify_signature(importedcryptokey);
}

/**
 * called when an error occurs during contact key import process
 * @param {object} error
 * @returns {void}
 */
function SOC_files_loadfile_contact_keyimported_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error importing the contact key. File signature cannot be verified');
    SOC_alert('Error importing the contact key. File signature cannot be verified');    
}
/**
 * called if an error occurs while validating a contact key file signature
 * @param {object} error
 * @returns {void}
 */
function SOC_files_loadfile_contact_file_signatureverified_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error verifying my signature on the contact key file. File signature cannot be verified');
    SOC_alert('Error verifying my signature on the contact key file. File signature cannot be verified');
}

/**
 * called after a contact file is loaded
 * @param {string} fileid
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_files_loadfile_contact_file_loaded_cb(fileid, response_fromprovider){
    SOC_updateprogress('info', 'Finished loading the contact key file');
    let contact_json = response_fromprovider.result;

    let signature_bytes = socglobal_base64.decodeAsByteArray(contact_json.signature);
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    let str_to_be_signed = contact_json.encryption + contact_json.signing;

    socglobal_files_state.contact_keyfile_json = contact_json;
    socrsassa.beginVerifySignature(socglobal_mypublickey_forverifying, signature_bytes, str_to_be_signed, 
                                    SOC_files_loadfile_contact_file_signatureverified_cb, 
                                    SOC_files_loadfile_contact_file_signatureverified_error_cb);

}
/**
 * called if an error occurs while downloading a contact file from google drive
 * @param {object} error
 * @returns {void}
 */
function SOC_files_loadfile_contact_file_loaded_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error downloading the signer contact file from my Google drive. The signature cannot be verified.');
    SOC_files_loadfile_decrypt_confirmation('Error downloading the signer contact file from my Google drive. The signature cannot be verified.');
}

/**
 * called after the signers key is imported
 * verifies the signature
 * @param {JSONWebKey} publickey
 * @returns {void}
 */
function SOC_files_loadfile_verify_signature(publickey){
    SOC_updateprogress('info', 'Starting to verify the file signature.');

    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();

    let signature_bytes = socglobal_base64.decodeAsByteArray(socglobal_files_state.file_data_result.signature.signature_value);
    socrsassa.beginVerifySignature(publickey, signature_bytes, 
                                    socglobal_files_state.file_data_result.data, 
                                    SOC_files_loadfile_verify_signature_cb, 
                                    SOC_files_loadfile_verify_signature_error_cb);
    
}

/**
 * starts decrypting the file IF the current user is 
 * one of the recipients for this file (i.e a key and IV entry exists for this user)
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file(){
    SOC_updateprogress('info', 'Starting to decrypt file contents.');
    let foundmeinrcpts = false;
    for(let rcptinfo of socglobal_files_state.file_data_result.recipients){
        if(socglobal_currentuseremail == rcptinfo.email){
            SOC_updateprogress('info', 'I\'m one of the allowed users for this file. Will start decrypting it now');
            foundmeinrcpts = true;
            socglobal_files_state.keyinfo_for_me = rcptinfo;
            
            //decrypt the IV and the AES key using my private key. will then use them to decrypt the file contents
            let socrsa = new SOC_RSA_OAEP();
            let encrypted_aeskey_bytes = socglobal_base64.decodeAsByteArray(socglobal_files_state.keyinfo_for_me.key);

            socrsa.beginDecrypt(socglobal_myprivatekey, encrypted_aeskey_bytes, 
                                SOC_files_loadfile_decrypt_file_aeskey_decrypted_cb, 
                                SOC_files_loadfile_decrypt_file_aeskey_decrypted_error_cb);
            break;
        }
    }
    if(!foundmeinrcpts){
        SOC_updateprogress('warn', 'I\'m not one of the allowed users for this file. Cannot decrypt it');
        SOC_alert('Failed to find a decryption key for me in the file. Unable to decrypt file contents');
    }
}

/**
 * called after the AES key is decrypted
 * @param {ArrayBuffer} decrypted_aeskey_bytes
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_aeskey_decrypted_cb(decrypted_aeskey_bytes){
    SOC_updateprogress('info', 'Decrypted the symmetric encryption key');

    socglobal_files_state.decrypted_aeskey_bytes = decrypted_aeskey_bytes;
    let encrypted_iv_bytes = socglobal_base64.decodeAsByteArray(socglobal_files_state.keyinfo_for_me.iv);
    let socrsa = new SOC_RSA_OAEP();
    socrsa.beginDecrypt(socglobal_myprivatekey, encrypted_iv_bytes, 
                            SOC_files_loadfile_decrypt_file_iv_decrypted_cb, 
                            SOC_files_loadfile_decrypt_file_iv_decrypted_error_cb);
    
}
/**
 * called if an error occurs while decrypting the AES key
 * file cannot be decrypted
 * @param {any} error
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_aeskey_decrypted_error_cb(error){
    SOC_updateprogress('error', 'Error decrypting the symmetric encryption key');
    SOC_alert('Error decrypting the file encryption key');
}

/**
 * called after the IV is decrypted
 * @param {ArrayBuffer} decrypted_iv_bytes
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_iv_decrypted_cb(decrypted_iv_bytes){
    SOC_updateprogress('info', 'Decrypted the random initialization vector for symmetric decryption');

    //now import the aes key bytes
    //let ciphertext_bytes = socglobal_base64.decodeAsByteArray(socglobal_files_state.file_data_result.data);
    let socaes = new SOC_AES_Decrypt();
    //(ciphertext_b64, ivdata, keydata, callback_onfinish, error_callback){
    socaes.begin(socglobal_files_state.file_data_result.data, 
                    decrypted_iv_bytes, 
                    socglobal_files_state.decrypted_aeskey_bytes, 
                    SOC_files_loadfile_decrypt_file_finished_cb, 
                    SOC_files_loadfile_decrypt_file_finished_error_cb);
}
/**
 * called if an error occurs while decrypting the IV
 * the file cannot be decrypted after this error
 * @param {any} error
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_iv_decrypted_error_cb(error){
    SOC_updateprogress('error', 'Error decrypting the symmetric encryption initialization vector. Being able to decrypt the symmetric key but failing to decrypt this value is very unexpected');
    SOC_alert('Error decrypting the symmetric encryption initialization vector. Being able to decrypt the symmetric key but failing to decrypt this value is very unexpected');
}

/**
 * finally the file is decrypted
 * now we will either display it in the text area or will make it available for downloading
 * @param {ArrayBuffer} decrypted_file_bytes
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_finished_cb(decrypted_file_bytes){
    SOC_updateprogress('info', 'Finished decrypting the file');
    let txtdecoder = new TextDecoder('utf-8');        
    let decrypted_file_contents = txtdecoder.decode(decrypted_file_bytes);

    if(socglobal_files_state.files_fileid_mimetype_map[socglobal_files_state.current_file_id] && 
        socglobal_files_state.files_fileid_mimetype_map[socglobal_files_state.current_file_id].originalmimetype == 'text/plain')
    {
        SOC_updateprogress('info', 'It\'s a text file, will display the edit box');
        //text file, show in text area
        SOC_gebi('edittextfileform_filecontents').value = decrypted_file_contents;        
    }
    else{
        SOC_updateprogress('info', 'It\'s not a text file, but it can be downloaded');
            //create  temporary blob file
            let tmpfirstcolonpos =  decrypted_file_contents.indexOf(':');
            let tmpfirstsemicolonpos =  decrypted_file_contents.indexOf(',');
            let tmpfirstcommapos = decrypted_file_contents.indexOf(',');
            let tmpattachmentcontenttype = decrypted_file_contents.substring(tmpfirstcolonpos+1, tmpfirstsemicolonpos);
            let blobforattachment = new Blob(
                                            [socglobal_base64.decodeAsByteArray(
                                                decrypted_file_contents.substring(tmpfirstcommapos+1))],
                                            {type:tmpattachmentcontenttype}
                                            );
            
            var tmpbloburl = window.URL.createObjectURL(blobforattachment);
            if(!socglobal_files_state.tmp_blob_urls){
                socglobal_files_state.tmp_blob_urls = new Array();
            }
            socglobal_files_state.tmp_blob_urls.push(tmpbloburl);
            

        let downloadlinkdiv = SOC_gebi('viewbinaryfilediv_downloadlinkdiv');
        let htmlescapedfilename = SOC_escapehtml(SOC_gebi('edittextfileform_filename').value);
        //downloadlinkdiv.style.display ='';
        downloadlinkdiv.innerHTML='<a href="'+tmpbloburl+
                                             '" download="'+htmlescapedfilename+'">'+htmlescapedfilename+'</a>';

    }
}
/**
 * called if an error occurs while decrypting the file
 * @param {any} error
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_finished_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error decrypting file contents : ' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error decrypting file contents');
}

/**
 * called after the signature verification is completed
 * @param {boolean} isverified
 * @returns {void}
 */
function SOC_files_loadfile_verify_signature_cb(isverified){
    let signaturestatusdiv = null;
    if(window.location.hash=='#edittextfile'){
        signaturestatusdiv = SOC_gebi('edittextfileform_signaturestatusdiv');
    }
    else{
        signaturestatusdiv = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');
    }

    if(isverified){
        SOC_updateprogress('info', 'The signature on the file is valid. Starting to decrypting the file');
        signaturestatusdiv.setAttribute('class', 'signature-valid');
        signaturestatusdiv.innerText = 'FILE SIGNATURE IS VALID. Signed by: ' + socglobal_files_state.file_data_result.signature.signer;
        SOC_files_loadfile_decrypt_file();
    }
    else{
        signaturestatusdiv.setAttribute('class', 'signature-invalid');
        signaturestatusdiv.innerText = 'FILE SIGNATURE IS INVALID. Signed by: ' + socglobal_files_state.file_data_result.signature.signer;
        SOC_updateprogress('error', 'The signature is invalid! File contents cannot be trusted. Decryption will not start automatically. Needs to be initiated by the user.');
        SOC_files_loadfile_decrypt_confirmation('The signature is invalid!');
    }
}

/**
 * called when file signature can't be verified for some reason  
 * the user is asked to click a button to decrypt the file anyway
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_confirmation(msg){
    SOC_alert(msg + ' File contents cannot be trusted. They are not automatically decrypted. <br>'+
            '<button onclick="SOC_alert_close(); SOC_files_loadfile_decrypt_file();">Click here to decrypt the file anyway</button>.');
    
}

/**
 * called if an error occurs while verifying the file signature
 * @param {any} error
 * @returns {void}
 */
function SOC_files_loadfile_verify_signature_error_cb(error){
    SOC_updateprogress('error', 'Error verifying the file signature. Failed to verify the signature. Error:' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error verifying the file signature. Failed to verify the signature!');
    let signaturestatusdiv = null;
    if(window.location.hash=='#addtextfile'){
        signaturestatusdiv = SOC_gebi('edittextfileform_signaturestatusdiv');
    }
    else{
        signaturestatusdiv = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');
    }    
    signaturestatusdiv.setAttribute('class', 'signature-unknown');
    signaturestatusdiv.innerText = 'FILE SIGNATURE COULD NOT BE VALIDATED DUE TO AN ERROR. Signed by: ' + socglobal_files_state.file_data_result.signature.signer;
    
}
/**
 * called if an error occurs while downloading the file from google
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_files_loadfile_error_cb(response_fromprovider){
    console.log(response_fromprovider);
    SOC_updateprogress('error', 'Error loading the file:' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error loading file. See logs for more details');
}

/**
 * entry point for binary files
 * adding or updating a binary file
 * @returns {void}
 */
function SOC_files_editbinaryfile_submit(){
    socglobal_fileedit_state = {}; 
    let fileinput = SOC_gebi('editbinaryfileform_fileinput');
    if(fileinput.files.length!=1){       
        SOC_updateprogress('warn','You must select a file to continue');
        SOC_alert('Please select a file');
        return;
    }
    
    let selected_file = fileinput.files[0]; 
    
    socglobal_fileedit_state.filename = selected_file.name;
    SOC_updateprogress('info', 'Starting to read the selected file:' + socglobal_fileedit_state.filename);
    
    let filereader = new FileReader();
    filereader.addEventListener('load', SOC_files_editbinaryfile_submit_1_success);
    filereader.addEventListener('error', SOC_files_editbinaryfile_submit_1_error);
    filereader.readAsDataURL(selected_file);    
}
/**
 * called after a binary file is read as a dataurl
 * @param {object} filereader_event
 * @returns {void}
 */
function SOC_files_editbinaryfile_submit_1_success(filereader_event){
    
    //this is the data url for the file
    socglobal_fileedit_state.filecontents_raw = filereader_event.srcElement.result;

    let tmpfirstcolonpos =  socglobal_fileedit_state.filecontents_raw.indexOf(':');
    let tmpfirstsemicolonpos =  socglobal_fileedit_state.filecontents_raw.indexOf(';');

    let filecontenttype = socglobal_fileedit_state.filecontents_raw.substring(tmpfirstcolonpos+1, tmpfirstsemicolonpos);
    if(!filecontenttype || filecontenttype.length<1){
        filecontenttype = 'application/octet-stream';
    }
    socglobal_fileedit_state.mimetype = filecontenttype;
    SOC_updateprogress('info', 'Completed reading the file. Mime type:' + filecontenttype);
    SOC_files_edit_submit_1();
}
/**
 * called if an error occurs while reading a binary file
 * @param {object} filereader_event
 * @returns {void}
 */
function SOC_files_editbinaryfile_submit_1_error(filereader_event){
    SOC_alert('Error reading selected file');
    console.log(filereader_event);
}
/**
 * entry point for text files
 * adding or updating a text file
 * @returns {void}
 */
function SOC_files_edittextfile_submit(){
    
    let filename = SOC_gebi('edittextfileform_filename').value;
    if(!filename || filename.length<1){
        SOC_alert('Filename cannot be empty');
        return;
    }
    socglobal_fileedit_state = {}; 
    socglobal_fileedit_state.filename = filename;
    socglobal_fileedit_state.mimetype = 'text/plain';
    SOC_updateprogress('info', 'Starting to save the file');
    socglobal_fileedit_state.filecontents_raw = SOC_gebi('edittextfileform_filecontents').value;
    SOC_files_edit_submit_1();
}


/**
 * this is where we start actually encrypting and packaging
 * at this point if it's a binary file then we have read the file. if it's a text file 
 * file contents will be available in the textarea
 * @returns {void}
 */
function SOC_files_edit_submit_1(){
    //encrypt it with my key
    let socaes = new SOC_AES_Encrypt();
    socaes.generateKey(SOC_files_edit_submit_2, SOC_files_edit_submit_error_cb);
}

/**
 * called after the AES key for encryption is created
 * IV is created inside this function
 * @param {CryptoKey} generated_aes_key
 * @returns {void}
 */
function SOC_files_edit_submit_2(generated_aes_key){
    SOC_updateprogress('info', 'Generated the symmetric key for encryption');
    let random_iv = SOC_getRandomBytes(16);
    let socaes = new SOC_AES_Encrypt();
    let txtencoder = new TextEncoder('utf-8');
    let filecontents_bytes = txtencoder.encode(socglobal_fileedit_state.filecontents_raw);
    
    socglobal_fileedit_state.random_iv = random_iv;
    socglobal_fileedit_state.aes_key = generated_aes_key;

    socaes.encrypt(generated_aes_key, random_iv, filecontents_bytes, SOC_files_edit_submit_3, SOC_files_edit_submit_error_cb);
}

/**
 * called after file contents are encrypted using the aes key
 * now we will base64 encode it and add to the state variable
 * and then start encrypting the aes key with my encryption public key
 * @param {ArrayBuffer} ciphertext_buffer
 * @returns {void}
 */
function SOC_files_edit_submit_3(ciphertext_buffer){
    SOC_updateprogress('info', 'Encrypted the file contents using the symmetric key');
    socglobal_fileedit_state.filecontents_encrypted_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    let socaes = new SOC_AES_Encrypt();
    socaes.exportKey(socglobal_fileedit_state.aes_key, SOC_files_edit_submit_4, SOC_files_edit_submit_error_cb);
}

/**
 * called after exporting the raw AES encryption key
 * @param {ArrayBuffer} exported_aes_key_bytes
 * @returns {void}
 */
function SOC_files_edit_submit_4(exported_aes_key_bytes){
    SOC_updateprogress('info', 'Exported the symmetric key');
    let socrsa = new SOC_RSA_OAEP();
    socrsa.beginEncrypt(socglobal_mypublickey_forencryption, new Uint8Array(exported_aes_key_bytes), 
                            SOC_files_edit_submit_5, SOC_files_edit_submit_error_cb, null);
    
}

/**
 * TODO add support for other recipients. CURRENTLY FILES ARE ENCRYPTED ONLY USING THE CURRENT USERS KEYS
 * BUT IT SHOULD BE POSSIBLE TO ADD CONTACTS AS RECIPIENTS (RECIPIENT='USERS WHO CAN READ').
 * called after the aes key is encrypted using my public key
 * @param {ArrayBuffer} ciphertext_buffer
 * @param {undefined|null} extra_param_notused
 * @returns {void}
 */
function SOC_files_edit_submit_5(ciphertext_buffer, extra_param_notused){
    SOC_updateprogress('info', 'Encrypting the symmetric key using my public key');
    socglobal_fileedit_state.aes_key = null;
    socglobal_fileedit_state.aes_key_encrypted_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    let socrsa = new SOC_RSA_OAEP();
    //beginEncrypt(publickey_jwk_obj, plaintext_buffer, callback_onfinish, error_callback, extra_state_param){
    socrsa.beginEncrypt(socglobal_mypublickey_forencryption, socglobal_fileedit_state.random_iv, 
                            SOC_files_edit_submit_6, 
                            SOC_files_edit_submit_error_cb, null);
    
}
/**
 * called after the random IV is encrypted
 * at this stage we have : 
 *  - file contents encrypted using the aes key,
 *  - aes key encrypted using my encryption public key
 *  - random IV encrypted using my encryption public key
 *  now we sign the file, using my private signing key
 * @param {ArrayBuffer} ciphertext_buffer
 * @param {undefined|null} extra_param_notused
 * @returns {void}
 */
function SOC_files_edit_submit_6(ciphertext_buffer, extra_param_notused){
    SOC_updateprogress('info', 'Encrypted the symmetric encryption initialization vector using my public key');
    socglobal_fileedit_state.random_iv = null;
    socglobal_fileedit_state.random_iv_encrypted_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));    
    //now sign the doc
    let socssa = new SOC_RSASSA_PKCS1_v1_5();
    socssa.beginSign(socglobal_myprivatekey_forsigning, socglobal_fileedit_state.filecontents_encrypted_b64, 
                        SOC_files_edit_submit_7, SOC_files_edit_submit_error_cb);
}
/**
 * Called after the file is signed
 * @param {ArrayBuffer} signature_bytes
 * @returns {void}
 */
function SOC_files_edit_submit_7(signature_bytes){
    SOC_updateprogress('info', 'Finished signing the file');
    let signature_b64 = socglobal_base64.encodeBytes(new Uint8Array(signature_bytes));
    socglobal_fileedit_state.signature_b64 = signature_b64;
    SOC_files_edit_submit_8_encryption_finished();
}
/**
 * encryption process is over. 
 * now pack it and save it to drive
 * @returns {void}
 */
function SOC_files_edit_submit_8_encryption_finished(){
    SOC_updateprogress('info', 'Finished encrypting and signing the file. Ready to save it.');
    let fileid  = SOC_gebi('edittextfileform_fileid').value;
    //let filename = SOC_gebi('edittextfileform_filename').value;
    
    let filedata = {
        data:socglobal_fileedit_state.filecontents_encrypted_b64,
        recipients: [
            {
                email: socglobal_currentuseremail,
                iv: socglobal_fileedit_state.random_iv_encrypted_b64,
                key: socglobal_fileedit_state.aes_key_encrypted_b64
            }
        ],
        signature :{
                signer:socglobal_currentuseremail,
                signature_value: socglobal_fileedit_state.signature_b64
            }
    };
    
    let filedata_str = JSON.stringify(filedata);
    //file_id, filecontents_str, filename, original_mimetype, finished_callback, error_callbak

    socglobal_providerclient.saveFile(fileid, filedata_str, 
                                            socglobal_fileedit_state.filename, 
                                            socglobal_fileedit_state.mimetype, 
                                            SOC_files_edit_submit_finished,  
                                            SOC_files_edit_submit_error_cb);
}

function SOC_files_edit_submit_finished(response_fromprovider){
    SOC_updateprogress('info', 'Finished saving the file.');
    //console.log(response_fromprovider);
    if(response_fromprovider.result && response_fromprovider.result.id){
        SOC_files_editbinaryfileform_reset();
        SOC_files_edittextfileform_reset();
        SOC_alert('Successfully saved the file');
    }
    else{
        SOC_alert('Failed to save the file. Check logs for more details.');
    }
}


function SOC_files_edittextfileform_reset(){
    SOC_gebi('edittextfileform_filename').value ='';
    SOC_gebi('edittextfileform_filecontents').value ='';
    SOC_gebi('edittextfileform_fileid').value ='';
   
    
    let signaturediv_text = SOC_gebi('edittextfileform_signaturestatusdiv');
    let signaturediv_binary = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');

    signaturediv_text.innerHTML = '';
    signaturediv_text.removeAttribute('class');

    signaturediv_binary.innerHTML = '';
    signaturediv_binary.removeAttribute('class');

}

function SOC_files_editbinaryfileform_reset(){
    SOC_gebi('editbinaryfileform_fileinput').value ='';
    SOC_gebi('viewbinaryfilediv_downloadlinkdiv').innerHTML ='';
    SOC_gebi('editbinaryfileform_fileid').value ='';            
    let signaturediv_text = SOC_gebi('edittextfileform_signaturestatusdiv');
    let signaturediv_binary = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');

    signaturediv_text.innerHTML = '';
    signaturediv_text.removeAttribute('class');

    signaturediv_binary.innerHTML = '';
    signaturediv_binary.removeAttribute('class');
}

/**
 * called in multiple error cases, not the best error handling
 * @param {object} error
 * @returns {void}
 */
function SOC_files_edit_submit_error_cb(error){
    SOC_updateprogress('error', 'Error :'+  + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('An unexpected error occured. Please see logs for details');
}

