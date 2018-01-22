/* 
 * code for reading an email
 */


function SOC_reademail(mailid){   
    window.location.hash='#reademail';
    //resetting state to make sure that the signature verification event queue can wait for the attachment download
    SOC_reademail_cleanup_state();
    socglobal_reademail_state={
        mailid_at_provider:mailid,  //we will use this one to mark email as read
        tmp_blob_urls:new Array()
    };    
    SOC_updateprogress('info', 'Loading message with id:' + SOC_escapehtml(mailid));
    let templatediv = SOC_gebi('reademaildiv_template');
    let reademaildiv = SOC_gebi('reademaildiv');
    //reset the div
    reademaildiv.innerHTML = templatediv.innerHTML;    
    socglobal_providerclient.loadMail(mailid, SOC_reademail_2, SOC_reademail_error_cb);
}

/**
 * returns the part that contains the clear text body
 * @param {type} response_fromprovider
 * @returns {undefined}
 */
function SOC_reademail_get_insecurebody(response_fromprovider){
    for(let tmppart of response_fromprovider.result.payload.parts){
        if(tmppart.mimeType==="text/plain"){
            return tmppart;
        }
    }
}
/**
 * returns the part that contains the secure message (encrypted)
 * @param {type} response_fromprovider
 * @returns {undefined}
 */
function SOC_reademail_get_securemessage(response_fromprovider){
    for(let tmppart of response_fromprovider.result.payload.parts){
        if(tmppart.mimeType===SOC_SIMPLE_SECURE_MSG_MIME){
            return tmppart;
        }
    }
}
/**
 * returns the part that contains the signature
 * @param {type} response_fromprovider
 * @returns {SOC_reademail_get_signature.tmppart}
 */
function SOC_reademail_get_signature(response_fromprovider){
    for(let tmppart of response_fromprovider.result.payload.parts){
        if(tmppart.mimeType===SOC_SIMPLE_SECURE_SIGNATURE_MIME){
            return tmppart;
        }
    }
}

function SOC_reademail_2(response_fromprovider){ 
    let reademaildiv = SOC_gebi('reademaildiv');
    let targetdiv = document.createElement('div');
    targetdiv.className ='reademail-contents-div';
    let emailheaders = SOC_inbox_parseemailheaders(response_fromprovider);
    socglobal_reademail_state.from_email = emailheaders.from;
    
    let generatedhtml = '<div class="email-headers">'+
                        '<div class="email-subject" id="reademailsubjectdiv"></div>'+
                        '<div class="email-from"><b>From:</b>'+SOC_escapehtml(emailheaders.from)+'</div>'+
                        '<div class="email-to"><b>To:</b>'+SOC_escapehtml(emailheaders.to)+'</div>'+
                        '<div class="email-cc"><b>Cc:</b>'+SOC_escapehtml(emailheaders.cc)+'</div>'+
                        '<div class="email-date"><b>Date</b>'+SOC_escapehtml(emailheaders.date)+'</div>'+
                        '<div class="email-snippet"></div>'+    //just to clear float. as a separator TODO redesign
                        '</div>';
    ///now body. first the unencrypted part
    generatedhtml+='<div id="reademailbodydiv" class="email-body">';
    let insecurebodypart = SOC_reademail_get_insecurebody(response_fromprovider);
    
    generatedhtml+='<h3>Insecure Message (Not Encrypted or Signed)</h3><div id="reademailcleartextdiv"></div>';
    
    let securemessagepart = SOC_reademail_get_securemessage(response_fromprovider);
    if(securemessagepart.body.attachmentId){
        ///////we need a separate request to get this attachment. we will do it async here
        generatedhtml+='<div id="simple_secure_message_attachment_div"></div>';
        socglobal_providerclient.downloadEmailAttachment(response_fromprovider.result.id, securemessagepart.body.attachmentId,
                                                        SOC_readmail_securemessage_load_cb, SOC_readmail_securemessage_load_error_cb);
    }
    else{
        SOC_updateprogress('error','Could not find an attachment id for the secure message attachment');
        generatedhtml+='<div>ERROR: Could not find an attachment id for the secure message attachment.</div>';
    }
    
    let signaturepart = SOC_reademail_get_signature(response_fromprovider);
    if(signaturepart.body.attachmentId){
        SOC_updateprogress('info', 'The message contains a signature. Will verify the signature');
        ///////we need a separate request to get this attachment. we will do it async here
        generatedhtml+='<div id="simple_secure_signature_attachment_div">SIGNATURE VERIFICATION RESULT WILL BE DISPLAYED HERE WHEN COMPLETED</div>';
        socglobal_providerclient.downloadEmailAttachment(response_fromprovider.result.id, signaturepart.body.attachmentId, 
                                                        SOC_readmail_signature_load_cb, SOC_readmail_signature_load_error_cb);
    }
    else{
        SOC_updateprogress('error','Could not find an attachment id for the signature attachment');
        generatedhtml+='<div class="encryptedfield">ERROR: could not find an attachment id for the signature attachment.</div>';
    }
    generatedhtml+='</div>';    //end of email-body
    targetdiv.innerHTML = generatedhtml;
    reademaildiv.appendChild(targetdiv);
    
    //TODO assuming base64 and utf-8
    let insecurepart_b64decoded = socglobal_base64.decodeAsString(insecurebodypart.body.data);
    let reademailcleartextdiv = SOC_gebi('reademailcleartextdiv');
    let reademailcleartextdiv_textnode = document.createTextNode(insecurepart_b64decoded);
    reademailcleartextdiv.appendChild(reademailcleartextdiv_textnode);
    
    let reademailsubjectdiv = SOC_gebi('reademailsubjectdiv');
    let reademailsubjectdiv_textnode = document.createTextNode(emailheaders.subject);
    reademailsubjectdiv.appendChild(reademailsubjectdiv_textnode);
}
/**
 * called after downloading the secure message attachment from the provider
 * @param {type} response_fromprovider
 * @returns {undefined}
 */
function SOC_readmail_securemessage_load_cb(response_fromprovider){
    //id of the div is simple_secure_message_attachment_div
    SOC_updateprogress('info', 'Downloaded secure message attachment');    

    //now we have the data. decrypt it    
    let securemsg_json_str = socglobal_base64.decodeAsString(response_fromprovider.result.data);
    
    let securemsg_json_obj = JSON.parse(securemsg_json_str);
    //first find my key in securemsg_json_obj.keys 
    let keyforme = securemsg_json_obj.keys[socglobal_currentuseremail];
    let ivforme = securemsg_json_obj.ivs[socglobal_currentuseremail];
    socglobal_reademail_state.entiresecuremessage = response_fromprovider.result.data;
    socglobal_reademail_state.keyforme = keyforme;
    socglobal_reademail_state.ivforme = ivforme;
    socglobal_reademail_state.data = securemsg_json_obj.data;
    let socrsa = new SOC_RSA_OAEP();
    socrsa.beginDecrypt(socglobal_myprivatekey, socglobal_base64.decodeAsByteArray(keyforme), SOC_readmail_rsadecrypt_key_cb, SOC_readmail_rsadecrypt_key_error_cb);
}
/**
 * called after the AES key for the email for the current user is decrypted 
 * @param {ArrayBuffer} plaintext_buffer_foraeskey
 * @returns {void}
 */
function SOC_readmail_rsadecrypt_key_cb(plaintext_buffer_foraeskey){
    SOC_log(5, 'SOC_readmail_rsadecrypt_key_cb', 'Enter');
    SOC_updateprogress('info', 'Decrypted the aes key using my private key. Will decrypt the IV now.');
    socglobal_reademail_state.aeskey_buffer = plaintext_buffer_foraeskey;
    let socrsa = new SOC_RSA_OAEP();
    socrsa.beginDecrypt(socglobal_myprivatekey, socglobal_base64.decodeAsByteArray(socglobal_reademail_state.ivforme), SOC_readmail_rsadecrypt_iv_cb, SOC_readmail_rsadecrypt_iv_error_cb);
}
/**
 * called if an error occurs while decrypting the AES key
 * @param {type} error
 * @returns {undefined}
 */
function SOC_readmail_rsadecrypt_key_error_cb(error){
    SOC_log(5, 'SOC_readmail_rsadecrypt_key_error_cb', 'Enter');
    SOC_updateprogress('info', 'Error decrypting aes key using my private key:' + SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Failed to decrypt the decryption key. Unable to decrypt the secure message.');
    SOC_readmail_signature_verification_failed_update('Failed to decrypt the decryption key. Unable to decrypt the secure message.', false);
}
/**
 * called after the IV is decrypted
 * @param {ArrayBuffer} plaintext_buffer_foriv
 * @returns {void}
 */
function SOC_readmail_rsadecrypt_iv_cb(plaintext_buffer_foriv){
    SOC_log(5, 'SOC_readmail_rsadecrypt_iv_cb', 'Enter');
    SOC_updateprogress('info', 'Decrypted the IV using my private key. Ready to decrypt the actual encrypted data');
    socglobal_reademail_state.iv_buffer = plaintext_buffer_foriv;
    //now we have both the IV and the KEY. we can decrypt the data
    let socaesdec = new SOC_AES_Decrypt();
    socaesdec.begin(socglobal_reademail_state.data, socglobal_reademail_state.iv_buffer, socglobal_reademail_state.aeskey_buffer,
                    SOC_readmail_data_decrypted_cb, SOC_readmail_data_decrypted_error_cb,);
}
/**
 * called if the IV can not be decrypted.
 * this is very unexpected. why would not we be able to decrypt the IV if we were able to decrypt the AES key?
 * @param {any} error
 * @returns {void}
 */
function SOC_readmail_rsadecrypt_iv_error_cb(error){
    SOC_log(5, 'SOC_readmail_rsadecrypt_iv_error_cb', 'Enter');
    SOC_updateprogress('info', 'Error decrypting the IV using my private key:' + SOC_escapehtml(JSON.stringify(error)));
    //SOC_alert('Failed to decrypt the IV. This is very unexpected. Please review logs and investigate. Unable to decrypt the secure message');
    SOC_readmail_signature_verification_failed_update('Failed to decrypt the IV. This is very unexpected. Please review logs and investigate. Unable to decrypt the secure message', false);
    
}
/**
 * if you made it to here, it means that you have successfully decrypted the encrypted attachment
 * now it contains a json string. 
 * Parse it and show it to the user
 * 
 * @param {ArrayBuffer} data_cleartext_buffer
 * @returns {void}
 */
function SOC_readmail_data_decrypted_cb(data_cleartext_buffer){
    SOC_log(5, 'SOC_readmail_data_decrypted_cb', 'Enter');
    SOC_updateprogress('info', 'Decrypted the secure message');
    let txtdecoder = new TextDecoder('utf-8');
    let securemsg_str = txtdecoder.decode(data_cleartext_buffer);

    let securemsg_json_obj = JSON.parse(securemsg_str);
    
    let targetdiv = SOC_gebi('simple_secure_message_attachment_div');
    targetdiv.innerHTML = '<h3>Secure Message (Encrypted and Signed)</h3>';
    
    let txtelement = document.createTextNode(securemsg_json_obj.message);
    let divcontainerfor_txtelement = document.createElement('div');
    divcontainerfor_txtelement.setAttribute('id', 'reademailsecuremsgdiv');
    divcontainerfor_txtelement.appendChild(txtelement);
    
    targetdiv.appendChild(divcontainerfor_txtelement);
    
    ////mark email as read
    socglobal_providerclient.markEmailAsRead(socglobal_reademail_state.mailid_at_provider,
        function(responsefromprovider){
            SOC_updateprogress('info', 'Marked mail as read');
        },
        function(responsefromprovider){
            SOC_updateprogress('error', 'Error marking mail as read');
        }
    );
    
    ///TODO show attachments as well
    if(securemsg_json_obj.attachments){
        let h3forattachments = document.createElement('h3');
        h3forattachments.innerHTML='Secure Attachments (Encrypted and Signed)';
        targetdiv.appendChild(h3forattachments);
        
        let ulforattachments = document.createElement('ul');
        let attachmentcounter = 0;
        for(let tmpattachmentname in securemsg_json_obj.attachments){
            let tmpliforattachmentfile = document.createElement('li');
            /*
            tmpliforattachmentfile.innerHTML='<button onclick="SOC_readmail_open_attachment(this)" attachment-data="'+SOC_escapehtml(securemsg_json_obj.attachments[tmpattachmentname])+'">'+
                    SOC_escapehtml(tmpattachmentname)+'</button>';
            */
            let htmlescapedattachmentname = SOC_escapehtml(tmpattachmentname);
            let tmpfirstcolonpos =  securemsg_json_obj.attachments[tmpattachmentname].indexOf(':');
            let tmpfirstsemicolonpos =  securemsg_json_obj.attachments[tmpattachmentname].indexOf(';');
            let tmpfirstcommapos = securemsg_json_obj.attachments[tmpattachmentname].indexOf(',');
            let tmpattachmentcontenttype = securemsg_json_obj.attachments[tmpattachmentname].substring(tmpfirstcolonpos+1, tmpfirstsemicolonpos);
            let blobforattachment = new Blob(
                                            [socglobal_base64.decodeAsByteArray(
                                                securemsg_json_obj.attachments[tmpattachmentname].substring(tmpfirstcommapos+1))],
                                            {type:tmpattachmentcontenttype}
                                            );
            
            var tmpbloburl = window.URL.createObjectURL(blobforattachment);
            socglobal_reademail_state.tmp_blob_urls.push(tmpbloburl);
            
            tmpliforattachmentfile.innerHTML='<a href="'+tmpbloburl+
                                             '" download="'+htmlescapedattachmentname+'">'+htmlescapedattachmentname+'</a>';
            
            /*
            tmpliforattachmentfile.innerHTML='<a href="'+SOC_escapehtml(securemsg_json_obj.attachments[tmpattachmentname])+
                                             '" download="'+htmlescapedattachmentname+'">'+htmlescapedattachmentname+'</a>';
            */
            ulforattachments.appendChild(tmpliforattachmentfile);
            attachmentcounter++;
        }
        targetdiv.appendChild(ulforattachments);
    }
}

/**
 * called when an attachment is clicked
 * @returns void
 */
function SOC_readmail_open_attachment(this_fortheclickedelement){
    let attdata = this_fortheclickedelement.getAttribute('attachment-data');
    var html = '<html>' +
        '<style>html, body { padding: 0; margin: 0; } iframe { width: 100%; height: 100%; border: 0;}  </style>' +
        '<body>' +
        '<p></p>' +
        '<iframe type="application/pdf" src="' + attdata + '"></iframe>' +
        '</body></html>';
        var a = window.open("about:blank", "_blank");
        a.document.write(html);
        a.document.close();
}

/**
 * called when an error occurs during decryption of the secure data
 * @param {type} error
 * @returns {undefined}
 */
function SOC_readmail_data_decrypted_error_cb(error){
    SOC_updateprogress('error', 'Failed to decrypt the secure message' + SOC_escapehtml(JSON.stringify(error)));
}

function SOC_readmail_securemessage_load_error_cb(response_fromprovider){
    SOC_updateprogress('error', 'Error downloading secure message attachment '+SOC_escapehtml(JSON.stringify(response_fromprovider)));
}

function SOC_readmail_signature_load_cb(response_fromprovider){
    //id of the div is simple_secure_signature_attachment_div
    SOC_updateprogress('info', 'Downloaded signature attachment');
    socglobal_reademail_state.signature = response_fromprovider.result.data;
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    let fileid_for_contact = socglobal_mycontactslist[socglobal_reademail_state.from_email];
    SOC_log(4, 'SOC_readmail_signature_load_cb', 'File id for contact=' + fileid_for_contact);
    socglobal_providerclient.downloadFile(fileid_for_contact, SOC_readmail_signature_contactloaded_cb, 
                                            SOC_readmail_signature_contactloaded_error_cb);
}
function SOC_readmail_signature_load_error_cb(response_fromprovider){
    SOC_updateprogress('error', 'Error downloading signature attachment '+SOC_escapehtml(JSON.stringify(response_fromprovider)));
    SOC_readmail_signature_verification_failed_update('Error downloading signature attachment.', false);

}
/**
 * will be called when the contacts key file is downloaded from google drive for verification
 * first, in super paranoid mode, we will veirfy the signature of the contact KEY file
 * then we will use the public key from the key file if and only if the signature on the key file can be verified
 * @param {object} response_fromprovider 
 * @returns {void}
 */
function SOC_readmail_signature_contactloaded_cb(fileIdForContact, response_fromprovider){
    SOC_updateprogress('info','Downloaded the contact file from MY google drive');

    let contact_json = response_fromprovider.result;

    let signature_bytes = socglobal_base64.decodeAsByteArray(contact_json.signature);
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    let str_to_be_signed = contact_json.encryption + contact_json.signing;

    socglobal_reademail_state.contact_keyfile_json = contact_json;
    socrsassa.beginVerifySignature(socglobal_mypublickey_forverifying, signature_bytes, str_to_be_signed, SOC_readmail_signature_contactfile_signatureverified_cb, 
                                    SOC_readmail_signature_contactfile_signatureverified_error_cb);

}

/**
 * now, we verified the signature (which the current user signed while saving the contact) on the contact file
 * so we can use the contact's public key from the contact file to verify the signature on the email
 * @param {type} issignatureverified
 * @returns {undefined}
 */
function SOC_readmail_signature_contactfile_signatureverified_cb(issignatureverified){
    if(issignatureverified){
        SOC_updateprogress('info', 'Verified the signature on the contact file. It can be used to verify the signature on the email message.');
        
        let contactpublicsigningkey_json = socglobal_base64.decodeAsString(socglobal_reademail_state.contact_keyfile_json.signing);

        let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
        let contactpublickey_json_obj = JSON.parse(contactpublicsigningkey_json);
        socrsassa.beginImportJwkPublicKey(contactpublickey_json_obj, SOC_readmail_signature_contactkey_imported_cb, SOC_readmail_signature_contactkey_imported_error_cb);
    }
    else{
        SOC_updateprogress('warn', 'Could not verify the signature on the contact file in MY google drive.');
        //SOC_alert('Could not verify signature on the contact file (not the incoming email). This is unexpected and should be investigated (or are you using a different private key?');
        SOC_readmail_signature_verification_failed_update('Failed to verify message signature due because '+
                                                        'your signature on the contact\'s public key file could not be verified. '+
                                                        'This may happen if you are using a different key than the one you used to sign the '+
                                                        ' contact\'s key. You can retry after reimporting the contact\'s key', false);

    }
}

function SOC_readmail_signature_contactfile_signatureverified_error_cb(error){
    SOC_updateprogress('error', 'Error verifying MY signature on the contact file. Error :'+SOC_escapehtml(JSON.stringify(error)));
    SOC_readmail_signature_verification_failed_update('Failed to verify message signature due because '+
                                                        'your signature on the contact\'s public key file could not be verified due to an error. '+
                                                        'This may happen if you are using a different key than the one you used to sign the '+
                                                        ' contact\'s key. You can retry after reimporting the contact\'s key', false);
    
}

function SOC_readmail_signature_contactkey_imported_cb(importedcryptokey){
    SOC_updateprogress('info', 'Imported the contact\'s key, will verify message signature now');

    socglobal_reademail_state.imported_contact_publickey_for_verification = importedcryptokey;
    if(!socglobal_reademail_state.entiresecuremessage){
        SOC_updateprogress('warn', 'Signature verification will sleep for 1 seconds to wait for the content decryption event chain to catch up');
        socglobal_reademail_state.setintervalid_forsignature = window.setInterval(function(){ SOC_log(5, 'window.setInterval','calling SOC_readmail_perform_signature_verification'); SOC_readmail_perform_signature_verification();}, 1000);
    }
    else{
        SOC_readmail_perform_signature_verification();
    }                           
}

function SOC_readmail_perform_signature_verification(){
    if(socglobal_reademail_state.entiresecuremessage){
        window.clearInterval(socglobal_reademail_state.setintervalid_forsignature);
        let signature_bytes = socglobal_base64.decodeAsByteArray(socglobal_reademail_state.signature);
        let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
        let txtdecoder = new TextDecoder('utf-8');
        let signature_bytes_decoded = txtdecoder.decode(signature_bytes);
        ////it's double base64 encoded
        let signature_bytes_b64decoded_again = socglobal_base64.decodeAsByteArray(signature_bytes_decoded);
            socrsassa.beginVerifySignature(socglobal_reademail_state.imported_contact_publickey_for_verification, 
                                            signature_bytes_b64decoded_again, 
                                            socglobal_reademail_state.entiresecuremessage, 
                                            SOC_readmail_signature_verified_cb, 
                                            SOC_readmail_signature_verified_error_cb);
    }
}
function SOC_readmail_signature_contactkey_imported_error_cb(error){
    SOC_updateprogress('error', 'Error importing contact\'s public key for signature verification. Error :'+SOC_escapehtml(JSON.stringify(error)));
    //alert('Failed to verify message signature due to an error while importing contact\'s public key');
    SOC_readmail_signature_verification_failed_update('Failed to verify message signature due to an error while importing contact\'s public key', false);

}

function SOC_readmail_signature_verified_cb(isverified){
    if(isverified){
        SOC_updateprogress('info', 'Successfully verified the signature on the message. It can be trusted');
        SOC_readmail_signature_verification_succeeded_update();
    }   
    else{
        SOC_updateprogress('warn', 'Could not verify the message signature. It should not be trusted');
        SOC_readmail_signature_verification_failed_update('THE SIGNATURE IS INVALID - Contents should not be trusted', true);
    }
}

function SOC_readmail_signature_verified_error_cb(error){
    SOC_updateprogress('error', 'Error verifying signature on the message. Error :'+SOC_escapehtml(JSON.stringify(error)));
    SOC_readmail_signature_verification_failed_update('Failed to verify the signature on the message due to an error '+
                                                            '(see logs for details). It may not be from who it seems to be',
                                                    false);
}
/**
 * notify the user that the signature is valid
 * @returns {undefined}
 */
function SOC_readmail_signature_verification_succeeded_update(){
    let parentdiv = SOC_gebi('reademailbodydiv');
    let securemsgdiv = SOC_gebi('reademailsecuremsgdiv');
    let d = SOC_gebi('simple_secure_signature_attachment_div');
    //now we have to wait for rendering to complete. if signature verification completes before 
    //decryption and rendering of these divs, it will blow up due to a null reference
    if(!securemsgdiv || !parentdiv || !d){
        if(!socglobal_reademail_state.SOC_readmail_signature_verification_succeeded_update_intervalid){
            let newintervalid = window.setInterval(function(){            
                SOC_readmail_signature_verification_succeeded_update();
            }, 1000);
            socglobal_reademail_state.SOC_readmail_signature_verification_succeeded_update_intervalid = newintervalid;
        }
        return;
    } 
    if(socglobal_reademail_state.SOC_readmail_signature_verification_succeeded_update_intervalid){
        window.clearInterval(socglobal_reademail_state.SOC_readmail_signature_verification_succeeded_update_intervalid);
    }
    securemsgdiv.style.borderColor = 'green';
    parentdiv.style.borderColor = 'green';    
    d.innerHTML = '<div class="signature-valid">THE SIGNATURE IS VALID</div>';

}
/**
 * signature validation failed. 
 * there may be two cases : 
 * 1- failed before actually calling crypto.subtle.verify on the signature. this happens when contact key can't be found or validated
 *      this is more like a signature status unknown case
 * 2- crypto.subtle.verify fails. this is a real failed signature case
 * @param {string} reason
 * @param {boolean} didverifyactuallyfail
 * @returns {void}
 */
function SOC_readmail_signature_verification_failed_update(reason, didverifyactuallyfail){
    let parentdiv = SOC_gebi('reademailbodydiv');
    if(didverifyactuallyfail){
        parentdiv.style.borderColor = 'red';  
        
        let securemsgdiv = SOC_gebi('reademailsecuremsgdiv');
        if(securemsgdiv){
            securemsgdiv.style.borderColor = 'red';
        }
        
        let d = SOC_gebi('simple_secure_signature_attachment_div');
        d.innerHTML = '<div class="signature-invalid">'+reason+'</div>';
    }
    else{
        parentdiv.style.borderColor = 'grey';
        
        let securemsgdiv = SOC_gebi('reademailsecuremsgdiv');
        if(securemsgdiv){
            securemsgdiv.style.borderColor = 'grey';
        }        
        
        let d = SOC_gebi('simple_secure_signature_attachment_div');
        d.innerHTML = '<div class="signature-invalid">'+reason+'</div>';
    }
}

/**
 * we could not download the senders contact file. 
 * the sender may not be a trusted sender. The user should add the contact and contact's key file first 
 * and then re-read this email.
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_readmail_signature_contactloaded_error_cb(response_fromprovider){
    SOC_updateprogress('error', 'Error downloading contacts key file. Error :'+SOC_escapehtml(JSON.stringify(response_fromprovider)));
    SOC_readmail_signature_verification_failed_update('Failed to verify message signature because the key file for the contact could not be found.'+
                                                        'You can retry after adding the sender as a contact',
                                                false);
}

function SOC_reademail_error_cb(response_fromprovider){  
    SOC_updateprogress('error', 'Error loading email message:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
    SOC_alert('Error loading email message. See logs for details');
}
    


