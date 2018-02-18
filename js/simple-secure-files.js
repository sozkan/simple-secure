/* 
 * code for google drive files
 */

/**
 * cleans up temporary state
 * revokes blob urls and empties signature status fields
 * @returns {void}
 */
function SOC_files_cleanup_state(){
    SOC_updateprogress('info', 'Cleaning up files state');
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
    SOC_updateprogress('info', 'File search form submitted. Starting to search for files');
    let filter_str = SOC_gebi('filesfilterinput').value;
    let fileslistdiv = SOC_gebi('fileslistdiv');
    fileslistdiv.innerHTML = 'Searching... Please wait...';
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
            SOC_updateprogress('info', 'File search returned no results (searches only for encrypted files, unencrypted files will not be returned)');
        }
        else{
            SOC_updateprogress('info', 'File search returned '+responsefrom_provider.result.files.length+' results');
            fileslistdiv.innerHTML = '';
            for(let tmpfile of responsefrom_provider.result.files){
                //available properties for files : 
                //name,id, createdTime, modifiedTime, trashed, starred, webViewLink, webContentLink, ownedByMe, shared,
                //properties.originalMimeType
                //sharingUser.displayName, sharingUser.me, sharingUser.permissionId, sharingUser.emailAddress
                let tmpfilecontainerdiv = document.createElement('div');
                tmpfilecontainerdiv.setAttribute('class','file-item-div');
                tmpfilecontainerdiv.addEventListener('click', function(){
                                                            SOC_files_loadfile(tmpfile.id, tmpfile.name, tmpfile.properties.originalMimeType);
                                                        }
                                                );  //end of addEventListener

                let tmpfilenamediv = document.createElement('div');
                tmpfilenamediv.setAttribute('class', 'file-name');
                let tmpfilenametxt = document.createTextNode(tmpfile.name);
                tmpfilenamediv.appendChild(tmpfilenametxt);                
                tmpfilecontainerdiv.appendChild(tmpfilenamediv);
                
                
                let tmpfilepropertiesdiv_html = '<div class="file-property">Created: '+SOC_escapehtml(tmpfile.createdTime)+'</div>'+
                        '<div class="file-property">Modified: '+SOC_escapehtml(tmpfile.modifiedTime)+'</div>';
                if(tmpfile.trashed){
                    tmpfilepropertiesdiv_html+='<div class="file-property">(Trashed)</div>';
                }
                if(tmpfile.starred){
                    tmpfilepropertiesdiv_html+='<div class="file-property">(Starred)</div>';
                }
                if(tmpfile.shared){
                    tmpfilepropertiesdiv_html+='<div class="file-property">(Shared)</div>';
                }
                if(tmpfile.ownedByMe){
                    tmpfilepropertiesdiv_html+='<div class="file-property">Owned by me</div>';
                }
                if(tmpfile.sharingUser){
                    if(tmpfile.sharingUser.me){
                        tmpfilepropertiesdiv_html+='<div class="file-property">Shared by me</div>';
                    }
                    else{
                        tmpfilepropertiesdiv_html+='<div class="file-property">Shared by:'+
                                                        SOC_escapehtml(tmpfile.sharingUser.emailAddress+' '+tmpfile.sharingUser.displayName)+                                                            
                                                    '</div>';
                    }
                }
                let tmpfilepropertiesdiv = document.createElement('div');
                tmpfilepropertiesdiv.setAttribute('class', 'file-properties');                
                tmpfilepropertiesdiv.innerHTML = tmpfilepropertiesdiv_html;
                tmpfilecontainerdiv.appendChild(tmpfilepropertiesdiv);
                fileslistdiv.appendChild(tmpfilecontainerdiv);
            }   //for
        }   //else
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
    SOC_alert('Error during file search. See logs for more details');
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
    socglobal_files_state.is_local_file = false;
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
 * or after a local file is loaded 
 * @param {string} fileid : is null when loading a local file. will be google drive file id when it's a google drive file
 * @param {Object} response_fromprovider response from google drive
 * @returns {void}
 */
function SOC_files_loadfile_cb(fileid, response_fromprovider){
    if(fileid){
        SOC_updateprogress('info','Done downloading the file '+fileid);
    }
        //downloaded file                           //local file
    if((fileid && response_fromprovider.result) || (fileid==null && response_fromprovider) ){
        if(fileid){     //downloaded file
            socglobal_files_state.file_data_result = response_fromprovider.result;    
        }
        else{   //localfile
            socglobal_files_state.file_data_result = response_fromprovider;
            socglobal_files_state.current_file_id = null;
            //we navigate here because we dont know the file type until it's loaded
            if(socglobal_files_state.file_data_result.originalmimetype && socglobal_files_state.file_data_result.originalmimetype=='text/plain'){
                SOC_files_edittextfileform_reset();
                window.location.hash = '#edittextfile';
            }
            else{
                SOC_files_editbinaryfileform_reset();
                window.location.hash = '#editbinaryfile';
            }            
        }
        /////////first check the signature. 
        if(socglobal_files_state.file_data_result.signature){
            if(socglobal_files_state.file_data_result.signature.signer == socglobal_currentuseremail){
                //I signed it. verify using my current key
                SOC_updateprogress('info','The file was signed by me, will verify the signature using my own key');
                SOC_files_loadfile_verify_signature(socglobal_mypublickey_forverifying);
            }
            else{
                SOC_updateprogress('info','The file was signed by someone else ('+
                                    SOC_escapehtml(socglobal_files_state.file_data_result.signature.signer)+
                                    '), will download the contact\'s key and verify the signature using that key');
                ///someone else signed it. download the contact file and validate my signature on the contact file
                ///if it's valid. use the contact's key to validate the signature on the file 
                let fileid_for_contact = socglobal_mycontactslist[socglobal_files_state.file_data_result.signature.signer];
                    SOC_log(4, 'SOC_files_loadfile_cb', 'File id for contact=' + fileid_for_contact);
                    socglobal_providerclient.downloadFile(fileid_for_contact, 
                                                            SOC_files_loadfile_contact_file_loaded_cb, 
                                                            SOC_files_loadfile_contact_file_loaded_error_cb);
                
            }
        }
        //reset recipients
        socglobal_fileedit_state = {};
        socglobal_fileedit_state.recipients = {};
        ////recipients (list of people who can decrypt this file) list        
        let recipientsdiv = null;
        if(window.location.hash=='#editbinaryfile'){
            recipientsdiv = SOC_gebi('editbinaryfileform_originalrecipientsdiv');
        }
        else{
            recipientsdiv = SOC_gebi('edittextfileform_originalrecipientsdiv');
        }
        //reset div contents first
        recipientsdiv.innerHTML='';
        //then create new div contents
        let recipientsdivtitle = document.createElement('h4');
        recipientsdivtitle.innerText = 'This File Was Encrypted For:';
        recipientsdiv.appendChild(recipientsdivtitle);
        
        let recipientslist = document.createElement('ul');
        for(let tmprecipient of socglobal_files_state.file_data_result.recipients){
            let lielemforrcpt = document.createElement('li');
            lielemforrcpt.textContent=tmprecipient.email;
            recipientslist.appendChild(lielemforrcpt);
        }
        recipientsdiv.appendChild(recipientslist);
        SOC_files_rendercontacts();
        if(fileid){
            SOC_gebi('edittextfileform_fileid').value = fileid;
            SOC_gebi('edittextfileform_filename').value = socglobal_files_state.files_fileid_mimetype_map[fileid].filename;    
        }
        else{
            SOC_gebi('edittextfileform_fileid').value = null;
            //when local files are saved, they will be saved as new files in google drive
            SOC_gebi('edittextfileform_filename').value = '';   
        }
    }
    else{
        SOC_updateprogress('error','File download failed in a very unexpected way. Error:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
    }
}
/**
 * Note: these functions are copied from simple-secure-compose.js and it's intentional. 
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
    SOC_updateprogress('error', 'Error importing the contact key. File signature cannot be verified. See browser console for error details.');
    SOC_alert('Error importing the contact key. File signature cannot be verified. See logs for details.');    
}
/**
 * called if an error occurs while validating a contact key file signature
 * @param {object} error
 * @returns {void}
 */
function SOC_files_loadfile_contact_file_signatureverified_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error verifying my signature on the contact key file. File signature cannot be verified. See browser console for error details.');
    SOC_alert('Error verifying my signature on the contact key file. File signature cannot be verified. See logs for details.');
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
    let str_to_be_signed = contact_json.email + contact_json.encryption + contact_json.signing;

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
    SOC_updateprogress('error', 'Error downloading the signer contact file from my Google drive. The signature cannot be verified. See browser console for details.');
    SOC_files_loadfile_decrypt_confirmation('Error downloading the signer contact file from my Google drive. The signature cannot be verified. See logs for details.');
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
    SOC_updateprogress('info', 'Decrypted the symmetric encryption key. Starting to decrypt the initialization vector.');

    socglobal_files_state.decrypted_aeskey_bytes = decrypted_aeskey_bytes;
    let encrypted_iv_bytes = socglobal_base64.decodeAsByteArray(socglobal_files_state.keyinfo_for_me.iv);
    let socrsa = new SOC_RSA_OAEP();
    //now decrypt the IV
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
 * we can decrypt the file contents now
 * @param {ArrayBuffer} decrypted_iv_bytes
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_iv_decrypted_cb(decrypted_iv_bytes){
    SOC_updateprogress('info', 'Decrypted the random initialization vector for symmetric decryption. Ready to decrypt file contents');

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
    console.log(error);
    SOC_updateprogress('error', 'Error decrypting the symmetric encryption initialization vector. Being able to decrypt the symmetric key but failing to decrypt this value is very unexpected. See browser console for details.');
    SOC_alert('Error decrypting the symmetric encryption initialization vector. Being able to decrypt the symmetric key but failing to decrypt this value is very unexpected. See browser logs for more information.');
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
    let istextplain = socglobal_files_state.file_data_result.originalmimetype == 'text/plain';
    
    if(istextplain)
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
            
        if(socglobal_files_state.is_local_file){
            //you can't update a local file so we hide unnecessary fields
            SOC_gebi('editbinaryfileform_fileinputdiv').style.display='none';
            SOC_gebi('editbinaryfileform_recipients_containerdiv').style.display='none';            
            SOC_gebi('editbinaryfileform_buttonsdiv').style.display='none';
        }
        else{
            SOC_gebi('editbinaryfileform_fileinputdiv').style.display='';
            SOC_gebi('editbinaryfileform_recipients_containerdiv').style.display='';
            SOC_gebi('editbinaryfileform_buttonsdiv').style.display='';
        }

        let downloadlinkdiv = SOC_gebi('viewbinaryfilediv_downloadlinkdiv');
        let htmlescapedfilename = SOC_escapehtml(SOC_gebi('edittextfileform_filename').value);
        if(htmlescapedfilename){
            //downloadlinkdiv.style.display ='';
            downloadlinkdiv.innerHTML='<a target="_blank" href="'+tmpbloburl+
                                             '" download="'+htmlescapedfilename+'">'+htmlescapedfilename+'</a>';
        }
        else{
            //TODO: fix this. when filename is empty (i.e when opening a local file), we dont provide the download attribute. could this cause an unwanted security issue?
            downloadlinkdiv.innerHTML='<a target="_blank" href="'+tmpbloburl+'">CLICK HERE TO OPEN THE DECRYPTED FILE</a>';            
        }
    }
}
/**
 * called if an error occurs while decrypting the file
 * @param {any} error
 * @returns {void}
 */
function SOC_files_loadfile_decrypt_file_finished_error_cb(error){
    console.log(error);
    SOC_updateprogress('error', 'Error decrypting file contents (see browser console for more information): ' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error decrypting file contents. See logs for more information.');
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
        SOC_updateprogress('info', 'The signature on the file is valid. Starting to decrypt the file');
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
            '<button type="button" onclick="SOC_alert_close(); SOC_files_loadfile_decrypt_file();">Click here to decrypt the file anyway</button>.');
    
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
    SOC_updateprogress('error', 'Error loading the file:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
    SOC_alert('Error loading file. See logs for more details');
}

/**
 * entry point for binary files
 * adding or updating a binary file
 * @returns {void}
 */
function SOC_files_editbinaryfile_submit(){
    let tmprcptsforswap = socglobal_fileedit_state.recipients;
    socglobal_fileedit_state = {}; 
    socglobal_fileedit_state.recipients = tmprcptsforswap;
    let fileinput = SOC_gebi('editbinaryfileform_fileinput');
    if(fileinput.files.length!=1){       
        SOC_updateprogress('warn','You must select a file to continue');
        SOC_alert('Please select a file');
        return;
    }    
    SOC_begin_longoperation();
    SOC_updateprogress('info','Starting to save binary file');
    let selected_file = fileinput.files[0]; 
    
    socglobal_fileedit_state.filename = selected_file.name;
    SOC_updateprogress('info', 'Starting to read the selected file:' + SOC_escapehtml(socglobal_fileedit_state.filename));
    
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
    socglobal_fileedit_state.filecontents_raw = filereader_event.target.result;

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
    SOC_alert('Error reading selected file. See logs for more information.');
    SOC_updateprogress('Error reading selected binary file. Error:' + SOC_escapehtml(JSON.stringify(filereader_event)));
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
    SOC_begin_longoperation();
    let tmprcptsforswap = socglobal_fileedit_state.recipients;
    socglobal_fileedit_state = {}; 
    socglobal_fileedit_state.recipients = tmprcptsforswap;
    socglobal_fileedit_state.filename = filename;
    socglobal_fileedit_state.mimetype = 'text/plain';
    SOC_updateprogress('info', 'Starting to save the file (using text/plain type)');
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
    //begin AES encryptiong process by generating a new key
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
    //begin encrypting
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
 * step _5 need to be repeated for each recipient IF there are any additional recipients 
 * TODO encryption is run in parallel for all recipients. not sure if this may cause any problems 
 * when there are no additional recipients then it's just me. no need to loop
 * first add my email address and my publickey to the list of recipients 
 * and loop over all recipients 
 * called after exporting the raw AES encryption key
 * @param {ArrayBuffer} exported_aes_key_bytes
 * @returns {void}
 */
function SOC_files_edit_submit_4(exported_aes_key_bytes){
    SOC_updateprogress('info', 'Exported the symmetric key. Starting to encrypt the key and IV for each recipient');
    let allrecipients = Object.keys(socglobal_fileedit_state.recipients);
    socglobal_fileedit_state.number_of_recipients = 0;
    
    if(allrecipients && allrecipients.length>0){
        //we need to loop over all recipients
        socglobal_fileedit_state.number_of_recipients = allrecipients.length;
        socglobal_fileedit_state.recipients[socglobal_currentuseremail] = socglobal_mypublickey_forencryption;  //add myself to recipients        
        //used to keep track of processed recipients
        socglobal_fileedit_state.processed_recipients = {};
        
        for(let tmprecipientemail of allrecipients){
            socglobal_fileedit_state.processed_recipients[tmprecipientemail] = {
                finished:false
            };
            let socrsa = new SOC_RSA_OAEP();
            socrsa.beginEncrypt(socglobal_fileedit_state.recipients[tmprecipientemail], 
                                new Uint8Array(exported_aes_key_bytes), 
                                SOC_files_edit_submit_5, SOC_files_edit_submit_5_7_error_cb, tmprecipientemail);                                
        }   //for        
        ///and myself. this is not in the allrecipients array. so just adding it here
        socglobal_fileedit_state.processed_recipients[socglobal_currentuseremail] = {
            finished:false
        };
        let socrsa = new SOC_RSA_OAEP();
        socrsa.beginEncrypt(socglobal_mypublickey_forencryption, new Uint8Array(exported_aes_key_bytes), 
                                SOC_files_edit_submit_5, SOC_files_edit_submit_error_cb, socglobal_currentuseremail);        

    }
    else{
        //no additional recipients, just me. no need to loop
        socglobal_fileedit_state.processed_recipients = {};
        socglobal_fileedit_state.processed_recipients[socglobal_currentuseremail] = {
            finished:false
        };
        let socrsa = new SOC_RSA_OAEP();
        socrsa.beginEncrypt(socglobal_mypublickey_forencryption, new Uint8Array(exported_aes_key_bytes), 
                                SOC_files_edit_submit_5, SOC_files_edit_submit_error_cb, socglobal_currentuseremail);        
    }
    
}

/**
 * called in case of an error only if there are more than one recipients
 * @param {object} error
 * @param {string} recipient_email_addr
 * @returns {void}
 */
function SOC_files_edit_submit_5_7_error_cb(error, recipient_email_addr){
    socglobal_fileedit_state.processed_recipients[recipient_email_addr].finished=true;
    SOC_files_edit_submit_error_cb(error);
}

/**
 * called after the aes key is encrypted using my public key
 * @param {ArrayBuffer} ciphertext_buffer
 * @param {undefined|null} extra_param_notused
 * @returns {void}
 */
function SOC_files_edit_submit_5(ciphertext_buffer, recipient_email_addr){
    SOC_updateprogress('info', 'Encrypting the initialization vector using the public key for '+SOC_escapehtml(recipient_email_addr));    
    socglobal_fileedit_state.processed_recipients[recipient_email_addr].aes_key_encrypted_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));
    
    let socrsa = new SOC_RSA_OAEP();
    if(socglobal_fileedit_state.number_of_recipients>0){
        //we have more than one recipient
        socrsa.beginEncrypt(socglobal_fileedit_state.recipients[recipient_email_addr], socglobal_fileedit_state.random_iv, 
                            SOC_files_edit_submit_6, 
                            SOC_files_edit_submit_5_7_error_cb, recipient_email_addr);
    }
    else{   //no additional recipients, it's only me
        socrsa.beginEncrypt(socglobal_mypublickey_forencryption, socglobal_fileedit_state.random_iv, 
                            SOC_files_edit_submit_6, 
                            SOC_files_edit_submit_error_cb, socglobal_currentuseremail);
    }
}

/**
 * determines if all recipients are processed or not
 * calls SOC_files_edit_submit_6_5 if all recipients are done
 * @param {string} done_msg message to be logged when done
 * @param {string} wait_msg message to be logged if still need to wait
 * @returns {void}
 */
function SOC_files_edit_submit_6_to_7_if_done(done_msg, wait_msg){
    let cancontinuewithsigning = true;
    
    for(let tmpprocrcptstatus of Object.values(socglobal_fileedit_state.processed_recipients)){
        if(!tmpprocrcptstatus.finished){
            cancontinuewithsigning = false;
            break;
        }
    }
    if(cancontinuewithsigning){
        //processed all recipients. can move on with signing
        SOC_updateprogress('info', done_msg);
        SOC_files_edit_submit_6_5();    
    }
    else{
        SOC_updateprogress('info', wait_msg);
    }
    
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
function SOC_files_edit_submit_6(ciphertext_buffer, recipient_email_addr){
    SOC_updateprogress('info', 'Encrypted the symmetric encryption initialization vector using recipients('+recipient_email_addr+') public key');
    
    socglobal_fileedit_state.processed_recipients[recipient_email_addr].random_iv_encrypted_b64 = socglobal_base64.encodeBytes(new Uint8Array(ciphertext_buffer));    
    if(socglobal_fileedit_state.number_of_recipients>0){
        //we have multiple recipients so we need to wait until all of them are finished
        socglobal_fileedit_state.processed_recipients[recipient_email_addr].finished=true;        
        SOC_files_edit_submit_6_to_7_if_done('Finished encrypting all recipients. Starting to sign the file', 
                'Finished encrypting for '+SOC_escapehtml(recipient_email_addr)+' but need to wait for other recipients');
    }
    else{   //no additional recipients. it's only me. continue with signing
        SOC_files_edit_submit_6_5();    
    }
}

function SOC_files_edit_submit_6_5(){
    socglobal_fileedit_state.random_iv = null;
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
    
    //create the final recipients object from socglobal_fileedit_state.processed_recipients
    let finalrecipients = [];
    for(let tmprcptemail in socglobal_fileedit_state.processed_recipients){
        let tmprcptobj = {
            email: tmprcptemail,
            iv: socglobal_fileedit_state.processed_recipients[tmprcptemail].random_iv_encrypted_b64,
            key: socglobal_fileedit_state.processed_recipients[tmprcptemail].aes_key_encrypted_b64
        };
        finalrecipients.push(tmprcptobj);
    }
    let filedata = {
        data:socglobal_fileedit_state.filecontents_encrypted_b64,
        recipients: finalrecipients,
        originalmimetype:socglobal_fileedit_state.mimetype,     //needed for offline viewing of files
        signature :{
                signer:socglobal_currentuseremail,
                signature_value: socglobal_fileedit_state.signature_b64
            }
    };
    
    let filedata_str = JSON.stringify(filedata);
    
    //file_id, filecontents_str, filename, original_mimetype, finished_callback, error_callback
    socglobal_providerclient.saveFile(fileid, filedata_str, 
                                            socglobal_fileedit_state.filename, 
                                            socglobal_fileedit_state.mimetype, 
                                            SOC_files_edit_submit_finished,  
                                            SOC_files_edit_submit_error_cb);
}
/**
 * called after the file is saved to google drive
 * Note : we don't wait for the results of the sharing operations!
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_files_edit_submit_finished(response_fromprovider){
    SOC_updateprogress('info', 'Finished saving the file.');
    
    if(response_fromprovider.result && response_fromprovider.result.id){
        let sharing_type = 0;
        let send_notificationemails = false;
        if(socglobal_fileedit_state.mimetype=='text/plain'){
            if(SOC_gebi('edittextfileform_sharewithrcpts_1').checked){
                sharing_type = 1;
            }
            else{
                if(SOC_gebi('edittextfileform_sharewithrcpts_2').checked){
                    sharing_type = 2;
                }    
            }
            send_notificationemails = SOC_gebi('edittextfileform_notifyshared').checked;
        }
        else{   //binary file
            if(SOC_gebi('editbinaryfileform_sharewithrcpts_1').checked){
                sharing_type = 1;
            }
            else{
                if(SOC_gebi('editbinaryfileform_sharewithrcpts_2').checked){
                    sharing_type = 2;
                }    
            }
            send_notificationemails = SOC_gebi('editbinaryfileform_notifyshared').checked;
        }
        //where 1=reader 2=writer
        if(sharing_type==1 || sharing_type==2){
            for(let tmpemailaddr in socglobal_fileedit_state.processed_recipients){
                if(socglobal_currentuseremail == tmpemailaddr){
                    continue;   //can't share with myself
                }
                let tmppermmissiontype ='reader';
                if(sharing_type==2){
                    tmppermmissiontype ='writer';
                }
                socglobal_providerclient.shareFile(response_fromprovider.result.id, tmpemailaddr, 
                                                    tmppermmissiontype, send_notificationemails, 
                                                    SOC_files_edit_submit_share_finished_cb, 
                                                    SOC_files_edit_submit_share_error_cb);
            }   //for
        }   //if sharing
        //done reset everything
        SOC_files_editbinaryfileform_reset();
        SOC_files_edittextfileform_reset();
        if(sharing_type==1 || sharing_type==2){
            SOC_alert('Successfully saved the file and shared it with recipients. See logs for more details about share operations.');
        }
        else{
            SOC_alert('Successfully saved the file');
        }
    }
    else{
        SOC_alert('Failed to save the file. Check logs for more details.');
    }
}

/**
 * called when a file share operation succeeds
 * this is just logged. no UI notification is generated
 * @param {string} fileid
 * @param {string} contactemail
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_files_edit_submit_share_finished_cb(fileid, contactemail, response_fromprovider){
    SOC_updateprogress('info', 'Successfully shared file '+SOC_escapehtml(fileid)+' with '+SOC_escapehtml(contactemail));
}

/**
 * called when a file share operation fails
 * no UI notification is generated. this is only logged
 * @param {string} fileid
 * @param {string} contactemail
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_files_edit_submit_share_error_cb(fileid, contactemail, response_fromprovider){
    SOC_updateprogress('error', 'Error sharing file '+SOC_escapehtml(fileid)+' with '+SOC_escapehtml(contactemail)+' Error:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
}

/**
 * reset the text file form
 * @returns {void}
 */
function SOC_files_edittextfileform_reset(){
    socglobal_fileedit_state = {};
    socglobal_fileedit_state.recipients = {};
    let origrecipientsdiv = SOC_gebi('edittextfileform_originalrecipientsdiv');
    origrecipientsdiv.innerHTML='';    
    let recipientsdiv = SOC_gebi('edittextfileform_recipientsdiv');
    recipientsdiv.innerHTML='No one';    

    SOC_files_rendercontacts();

    SOC_gebi('edittextfileform_filename').value ='';
    SOC_gebi('edittextfileform_filecontents').value ='';
    SOC_gebi('edittextfileform_fileid').value ='';
   
    
    let signaturediv_text = SOC_gebi('edittextfileform_signaturestatusdiv');
    let signaturediv_binary = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');

    signaturediv_text.innerHTML = '';
    signaturediv_text.removeAttribute('class');

    signaturediv_binary.innerHTML = '';
    signaturediv_binary.removeAttribute('class');

    SOC_gebi('edittextfileform_sharewithrcpts_0').checked = true;
    SOC_gebi('edittextfileform_sharewithrcpts_1').checked = false;
    SOC_gebi('edittextfileform_sharewithrcpts_2').checked = false;
    SOC_gebi('edittextfileform_notifyshared').checked = false;

}
/**
 * resets the binary file form 
 * @returns {void}
 */
function SOC_files_editbinaryfileform_reset(){
    socglobal_fileedit_state = {};
    socglobal_fileedit_state.recipients = {};
    let origrecipientsdiv = SOC_gebi('editbinaryfileform_originalrecipientsdiv');
    origrecipientsdiv.innerHTML='';    
    let recipientsdiv = SOC_gebi('editbinaryfileform_recipientsdiv');
    recipientsdiv.innerHTML='No one';    
    
    SOC_files_rendercontacts();
    //show if hidden
    SOC_gebi('editbinaryfileform_fileinputdiv').style.display='';
    SOC_gebi('editbinaryfileform_recipients_containerdiv').style.display='';
    SOC_gebi('editbinaryfileform_buttonsdiv').style.display='';

    SOC_gebi('editbinaryfileform_fileinput').value ='';
    SOC_gebi('viewbinaryfilediv_downloadlinkdiv').innerHTML ='';
    SOC_gebi('editbinaryfileform_fileid').value ='';            
    let signaturediv_text = SOC_gebi('edittextfileform_signaturestatusdiv');
    let signaturediv_binary = SOC_gebi('viewbinaryfilediv_signaturestatusdiv');

    signaturediv_text.innerHTML = '';
    signaturediv_text.removeAttribute('class');

    signaturediv_binary.innerHTML = '';
    signaturediv_binary.removeAttribute('class');
    
    SOC_gebi('editbinaryfileform_sharewithrcpts_0').checked = true;
    SOC_gebi('editbinaryfileform_sharewithrcpts_1').checked = false;
    SOC_gebi('editbinaryfileform_sharewithrcpts_2').checked = false;
    SOC_gebi('editbinaryfileform_notifyshared').checked = false;

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

/**
 * adding a new recipient (a person who can decrypt the file) to the file
 * @param {string} emailaddr
 * @returns {void}
 */
function SOC_files_addrecipient(emailaddr){
    let escapedemailaddr = SOC_escapehtml(emailaddr);
    if(!socglobal_mycontactslist[emailaddr]){        
        SOC_updateprogress('warn','Could not find a key for '+escapedemailaddr+'. ');
        SOC_alert('We don\'t have a key file for '+escapedemailaddr+'!');
        return;
    }
    SOC_updateprogress('info','Adding '+escapedemailaddr+' to the list of allowed recipients.');
    socglobal_providerclient.downloadFile(socglobal_mycontactslist[emailaddr], SOC_files_addrecipient_2, SOC_files_addrecipient_error_cb);
    socglobal_fileedit_state.currently_adding_contact = emailaddr;
}
/**
 * called in case of an error
 * @param {object} error
 * @returns {void}
 */
function SOC_files_addrecipient_error_cb(error){
    SOC_log(1, 'SOC_files_addrecipient_error_cb', error);
    SOC_updateprogress('error','Error adding recipient. ');
    SOC_alert('Error adding recipient: '+ SOC_escapehtml(error));
}

/**
 * called after the contact file is downloaded from google
 * begins signature validation on the contact file
 * @param {string} fileId for the contact
 * @param {object} contact_keyfile JSON obj from google api
 * @returns {void}
 */
function SOC_files_addrecipient_2(fileId, contact_keyfile){    
    SOC_updateprogress('info', 'Downloaded the key file for recipient');
    let contact_json = contact_keyfile.result;
    socglobal_fileedit_state.current_recipient_keyinfo_json = contact_json;

    let signature_bytes = socglobal_base64.decodeAsByteArray(contact_json.signature);
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    ///we sign and validate only encryption and signing keys. not the entire file
    let str_to_be_signed = contact_json.email + contact_json.encryption + contact_json.signing;
    socrsassa.beginVerifySignature(socglobal_mypublickey_forverifying, signature_bytes, str_to_be_signed, SOC_files_addrecipient_3, SOC_files_addrecipient_error_cb);
}
/**
 * called after the signature on the contact key file is verified
 * import the contact's public key (encryption) if the signature is verified
 * @param {boolean} issignature_verified
 * @returns {void}
 */
function SOC_files_addrecipient_3(issignature_verified){
    if(issignature_verified){
        SOC_log(4, 'SOC_files_addrecipient_3', 'Verified the public key signature on recipient key file');    
        SOC_updateprogress('info', 'Verified the signature on the recipient key file. We can encrypt the file for this contact.');
        
        let contact_encryptionkey_json_str = socglobal_base64.decodeAsString(socglobal_fileedit_state.current_recipient_keyinfo_json.encryption);        
        let contact_encryptionkey_json_obj = JSON.parse(contact_encryptionkey_json_str);
        
        let socrsaoaep = new SOC_RSA_OAEP();
        socrsaoaep.beginImportJwkPublicKey(contact_encryptionkey_json_obj, SOC_files_addrecipient_4, SOC_files_addrecipient_error_cb);
    }
    else{
        SOC_updateprogress('warn', 'Failed to verify the signature on the contact key file. This may happen when you '+
                            'are using a different key than the one you used to create this contact(more likely) or if your '+
                            'Google account is compromised(less likely)');
        SOC_alert('Could not verify contact public key.<br>Are you using a different key than the one you used to create '+
                'this contact?<br>If so, please delete the existing contact key file from your google drive and import a new key.'+
                '<br>Or check if your Google account has been compromised?');
        SOC_files_remove_recipient(socglobal_fileedit_state.currently_adding_contact);
        socglobal_fileedit_state.currently_adding_contact = null;
    }
}
/**
 * called after importing the contact's key
 * @param {CryptoKey} imported_crypto_key
 * @returns {void}
 */
function SOC_files_addrecipient_4(imported_crypto_key){
    SOC_updateprogress('info', 'Imported the contact public key');
    socglobal_fileedit_state.recipients[socglobal_fileedit_state.currently_adding_contact] = imported_crypto_key;
    socglobal_fileedit_state.currently_adding_contact = null;     //reset to allow other contacts to be added
    
    //render/update list of already added recipients
    SOC_files_renderrecipients();
}

/**
 * remove a contact from the list of added contact
 * @param {string} emailaddr : when evaluates to false, enables all buttons
 * @returns {void}
 */
function SOC_files_remove_recipient(emailaddr){
    SOC_updateprogress('info', 'Removing recipient ' + SOC_escapehtml(emailaddr));
    if(emailaddr && socglobal_fileedit_state.recipients[emailaddr]){
        delete socglobal_fileedit_state.recipients[emailaddr];
    }        
    SOC_files_renderrecipients();
    let contactbuttons = null;
    if(window.location.hash=='#addbinaryfile' || window.location.hash == '#editbinaryfile'){
        contactbuttons = document.querySelectorAll('#editbinaryfileform_contactsdiv button');        
    }
    else{
        contactbuttons = document.querySelectorAll('#edittextfileform_contactsdiv button');
    }

    for(let tmpbutton of contactbuttons){
        if(emailaddr){
            if(tmpbutton.textContent == emailaddr){
                tmpbutton.disabled = false;
                break;
            }
        }
        else{
            tmpbutton.disabled = false;
        }
    }
}
/**
 * renders the list current of recipients 
 * @returns {void}
 */
function SOC_files_renderrecipients(){
    SOC_updateprogress('info', 'Rendering added (current) recipients');
    
    let targetdiv = null;
    if(window.location.hash=='#addbinaryfile' || window.location.hash == '#editbinaryfile'){
        targetdiv = SOC_gebi('editbinaryfileform_recipientsdiv');        
    }
    else{
        targetdiv = SOC_gebi('edittextfileform_recipientsdiv');
    }
    
    let generatedhtml ='';
    for(let tmpemail in socglobal_fileedit_state.recipients){
        if(!tmpemail){
            continue;
        }
        let tmpescapedemail = SOC_escapehtml(tmpemail);
        generatedhtml +='<div>'+tmpescapedemail+'<button type="button" onclick="SOC_files_remove_recipient(\''+tmpescapedemail
                                                    +'\')">Remove</button></div>';
    }    
    if(generatedhtml==''){
        targetdiv.innerHTML = 'No one';
    }
    else{
        targetdiv.innerHTML = generatedhtml;
    }
}
/**
 * renders list of all contacts
 * @returns {void}
 */
function SOC_files_rendercontacts(){
    SOC_updateprogress('info', 'Rendering contacts');
    let targetdiv = null;
    if(window.location.hash=='#addbinaryfile' || window.location.hash == '#editbinaryfile'){
        targetdiv = SOC_gebi('editbinaryfileform_contactsdiv');        
    }
    else{
        targetdiv = SOC_gebi('edittextfileform_contactsdiv');
    }
    
    let generatedhtml ='';
    for(let tmpemail in socglobal_mycontactslist){
        if(!tmpemail){
            continue;
        }
        let tmpescapedemail = SOC_escapehtml(tmpemail);
        generatedhtml +='<button type="button" onclick="SOC_files_recipient_clicked(this, \''+tmpescapedemail+'\')">'+tmpescapedemail+'</button>';
    }    
    targetdiv.innerHTML = generatedhtml;
}

/**
 * called when a recipient is clicked. 
 * click events are queued and processed sequentially (using setInterval)
 * @param {element} clickedbutton
 * @param {string} emailaddr
 * @returns {void}
 */
function SOC_files_recipient_clicked(clickedbutton, emailaddr){
    //async event queue. we queue "add recipient" events to prevent confusion when 
    //the user clicks multiple recipient names 
    if(socglobal_fileedit_state.currently_adding_contact){
        let intervalid_foremail = window.setInterval(function(clickedbutton, emailaddr){
            SOC_files_recipient_clicked(clickedbutton, emailaddr);
        }, 1000);
        if(!socglobal_fileedit_state.addrecipient_queue){
            socglobal_fileedit_state.addrecipient_queue = {};
        }
        socglobal_fileedit_state.addrecipient_queue[emailaddr] = intervalid_foremail; 
    }
    else{
        if(socglobal_fileedit_state.addrecipient_queue){
            let intervalid_foremail = socglobal_fileedit_state.addrecipient_queue[emailaddr];
            if(intervalid_foremail){
                window.clearInterval(intervalid_foremail);
            }
        }
        SOC_files_addrecipient(emailaddr);
        clickedbutton.disabled = true;  //disable the button after adding the contact
    }
}

/**
 * used to load a local file (a file available on current device, not from google drive)
 * @returns {boolean} false (always returns false)
 */
function SOC_files_localfileform_submit(){
    let fileinput = SOC_gebi('fileslocalfileinput');
    if(fileinput.files.length<1){
        SOC_alert('Please select an encrypted file');
        return;
    }
    let thefile = fileinput.files[0];
    socglobal_files_state.is_local_file = true;
    SOC_updateprogress('info', 'Loading local file \''+SOC_escapehtml(fileinput.name)+'\'');
    let filereader = new FileReader();
    filereader.addEventListener('load', SOC_files_localfile_load_success);
    filereader.addEventListener('error', SOC_files_localfile_load_error);
    filereader.readAsText(thefile);
}

/**
 * called when a local file is read
 * @param {object} filereader_event
 * @returns {void}
 */
function SOC_files_localfile_load_success(filereader_event){
    SOC_updateprogress('info', 'Finished loading local file');
    let filejson = JSON.parse(filereader_event.target.result);
    SOC_files_loadfile_cb(null, filejson);
}
/**
 * called when reading a local file fails
 * @param {object} filereader_event
 * @returns {void}
 */
function SOC_files_localfile_load_error(filereader_event){
    SOC_alert('Error loading local file: ' + SOC_escapehtml(JSON.stringify(filereader_event)));
}