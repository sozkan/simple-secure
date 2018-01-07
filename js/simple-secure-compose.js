/* 
 * code for #compose
 */


/**
 * 
 * @param {Button} clickedbutton
 * @param {string} emailaddr
 * @returns {void}
 */
function SOC_composeemailform_recipient_clicked(clickedbutton, emailaddr){
    //implementing an async event queue just for this, insane?
    if(socglobal_composestate.currently_adding_contact){
        let intervalid_foremail = window.setInterval(function(clickedbutton, emailaddr){
            SOC_composeemailform_recipient_clicked(clickedbutton, emailaddr);
        }, 1000);
        if(!socglobal_composestate.addrecipient_queue){
            socglobal_composestate.addrecipient_queue = {};
        }
        socglobal_composestate.addrecipient_queue[emailaddr] = intervalid_foremail; 
    }
    else{
        if(socglobal_composestate.addrecipient_queue){
            let intervalid_foremail = socglobal_composestate.addrecipient_queue[emailaddr];
            if(intervalid_foremail){
                window.clearInterval(intervalid_foremail);
            }
        }
        SOC_composeemailform_addrecipient(emailaddr);
        clickedbutton.disabled = true;  //disable the button after adding the contact
    }
    
}
/**
 * download this users key and verify its signature
 * and add to recipients list if it's valid
 * @param {string} emailaddr
 * @returns {void}
 */
function SOC_composeemailform_addrecipient(emailaddr){
    
    //let thediv = SOC_gebi('composeemailform_recipientsdiv');
    if(!socglobal_mycontactslist[emailaddr]){
        SOC_updateprogress('warn','Could not find a key for '+SOC_escapehtml(emailaddr)+'. We can\'t send an encrypted email unless we have a key file for the contact.');
        SOC_alert('We don\'t have a key file for this email address!');
        return;
    }
    socglobal_providerclient.downloadFile(socglobal_mycontactslist[emailaddr], SOC_composeemailform_addrecipient_2, SOC_composeemailform_addrecipient_error_cb);
    socglobal_composestate.currently_adding_contact = emailaddr;
}
function SOC_composeemailform_addrecipient_error_cb(error){
    SOC_log(1, 'SOC_composeemailform_addrecipient_error_cb', error);
    SOC_updateprogress('error','Error adding recipient. Error='+ SOC_escapehtml(JSON.stringify(error)));
    SOC_alert('Error adding recipient: '+ SOC_escapehtml(error));
}

/**
 * 
 * @param {string} fileId for the contact
 * @param {object} contact_keyfile JSON obj from google api
 * @returns {void}
 */
function SOC_composeemailform_addrecipient_2(fileId, contact_keyfile){
    SOC_log(5, 'SOC_composeemailform_addrecipient_2', 'Enter');
    SOC_updateprogress('info', 'Downloaded the key file for contact');
    let contact_json = contact_keyfile.result;
    socglobal_composestate.current_contact_keyinfo_json = contact_json;

    let signature_bytes = socglobal_base64.decodeAsByteArray(contact_json.signature);
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    ///we sign and validate only encryption and signing keys. not the entire file
    let str_to_be_signed = contact_json.encryption + contact_json.signing;
    socrsassa.beginVerifySignature(socglobal_mypublickey_forverifying, signature_bytes, str_to_be_signed, SOC_composeemailform_addrecipient_3, SOC_composeemailform_addrecipient_error_cb);
}
/**
 * called after the signature on the contact key file is verified
 * import the contact's public key (encryption) if the signature is verified
 * @param {boolean} issignature_verified
 * @returns {void}
 */
function SOC_composeemailform_addrecipient_3(issignature_verified){
    SOC_log(5, 'SOC_composeemailform_addrecipient_3', 'Enter');    
    if(issignature_verified){
        SOC_log(4, 'SOC_composeemailform_addrecipient_3', 'Verified the public key signature');    
        SOC_updateprogress('info', 'Verified the signature on the contact key file. We can send a secure email to this recipient.');
        
        let contact_encryptionkey_json_str = socglobal_base64.decodeAsString(socglobal_composestate.current_contact_keyinfo_json.encryption);        
        let contact_encryptionkey_json_obj = JSON.parse(contact_encryptionkey_json_str);
        
        let socrsaoaep = new SOC_RSA_OAEP();
        socrsaoaep.beginImportJwkPublicKey(contact_encryptionkey_json_obj, SOC_composeemailform_addrecipient_4, SOC_composeemailform_addrecipient_error_cb);
    }
    else{
        SOC_log(4, 'SOC_composeemailform_addrecipient_3', 'Could not verify contact public key signature');
        SOC_updateprogress('warn', 'Failed to verify the signature on the contact key file. This may happen when you '+
                            'are using a different key than the one you used to create this contact(more likely) or if your '+
                            'Google account is compromised(less likely)');
        SOC_alert('Could not verify contact public key.<br>Are you using a different key than the one you used to create '+
                'this contact?<br>If so, please delete the existing contact key file from your google drive and import a new key.'+
                '<br>Or check if your Google account has been compromised?');
        SOC_composeemailform_remove_recipient(socglobal_composestate.currently_adding_contact);
        socglobal_composestate.currently_adding_contact = null;
    }
}
/**
 * called after importing the contact's key
 * @param {CryptoKey} imported_crypto_key
 * @returns {void}
 */
function SOC_composeemailform_addrecipient_4(imported_crypto_key){
    SOC_log(5, 'SOC_composeemailform_addrecipient_4', 'Enter');
    socglobal_composestate.recipients[socglobal_composestate.currently_adding_contact] = imported_crypto_key;
    socglobal_composestate.currently_adding_contact = null;     //reset to allow other contacts to be added
    
    //render list of already added recipients
    SOC_composeemailform_renderrecipients();
}

/**
 * remove a contact from the list of added contact
 * @param {string} emailaddr
 * @returns {void}
 */
function SOC_composeemailform_remove_recipient(emailaddr){
    delete socglobal_composestate.recipients[emailaddr];
    SOC_composeemailform_renderrecipients();
    let contactbuttons = document.querySelectorAll('#composeemailform_recipientsdiv_table button');

    for(let tmpbutton of contactbuttons){
        if(tmpbutton.textContent == emailaddr){
            tmpbutton.disabled = false;
            break;
        }
    }
}
/**
 * NOT USED 
 * renders the list current of recipients 
 * @returns {void}
 */
function SOC_composeemailform_renderrecipients(){
    SOC_updateprogress('info', 'Rendering added (current) recipients');
    SOC_log(5,'SOC_composeemailform_renderrecipients', 'Enter');
    let targetdiv = SOC_gebi('composeemailform_added_recipientsdiv');
    let generatedhtml ='';
    for(let tmpemail in socglobal_composestate.recipients){
        if(!tmpemail){
            continue;
        }
        let tmpescapedemail = SOC_escapehtml(tmpemail);
        generatedhtml +='<div>'+tmpescapedemail+'<button onclick="SOC_composeemailform_remove_recipient(\''+tmpescapedemail
                                                    +'\')">Delete</button></div>';
    }    
    targetdiv.innerHTML = generatedhtml;
}

/**
 * you click a contact address in contacts view and are taken to the compose window
 * @param {string} rcptemail
 * @returns {void}
 */
function SOC_startcomposing(rcptemail){
    SOC_log(5, 'SOC_startcomposing', 'Enter');    
    SOC_updateprogress('info','Starting to compose new message to:' + SOC_escapehtml(rcptemail));
    SOC_composeemailform_addrecipient(rcptemail);
    window.location.hash = '#compose';
}

/**
 * clears compose state and form fields
 * @returns {void}
 */
function SOC_composeemailform_reset(){
    SOC_updateprogress('info','Clearing compose state');
    socglobal_composestate = {};
    
    SOC_gebi('composeemail_reset').click();
    SOC_composeemailform_renderrecipients();
    
    //somehow this didnt work properly 
    //////SOC_gebi('composeemailform').reset();
    /*
    document.forms['composeemailform'].subject.value='';
    document.forms['composeemailform'].clearTextMessage.value='';
    document.forms['composeemailform'].encryptedMessage.value='';    
    */
}
/**
 * compose form is submitted
 * @returns {void}
 */
function SOC_composeemailform_submit(){
    SOC_log(5, 'SOC_composeemailform_submit', 'Enter');   
    
    if(socglobal_composestate.recipients.length<1){
        SOC_alert('You didn\'t add any recipients. At least one recipient must be selected to send or save as draft.');
        return;
    }
    
    SOC_updateprogress('info','Compose form submitted. Starting to prepare the email package.');

    let encryptedMessage = document.forms['composeemailform'].encryptedMessage.value;

    //////////now create the encrypted stuff
    SOC_datapackage_init();
    SOC_datapackage_addmessage(encryptedMessage);
    /////////add attachments
    let selected_attachment_files = [];    
    if(document.forms['composeemailform'].addnewcontactkeyfileinput1.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput1.files[0]);
    }
    if(document.forms['composeemailform'].addnewcontactkeyfileinput2.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput2.files[0]);
    }
    if(document.forms['composeemailform'].addnewcontactkeyfileinput3.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput3.files[0]);
    }
    if(document.forms['composeemailform'].addnewcontactkeyfileinput4.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput4.files[0]);
    }
    if(document.forms['composeemailform'].addnewcontactkeyfileinput5.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput5.files[0]);
    }
    if(document.forms['composeemailform'].addnewcontactkeyfileinput6.files.length==1){
        selected_attachment_files.push(document.forms['composeemailform'].addnewcontactkeyfileinput5.files[0]);
    }    
    
    if(selected_attachment_files.length>0){
        SOC_datapackage_addattachment_array(selected_attachment_files, SOC_composeemailform_submit_0_5, SOC_composeemailform_submit_error_cb);
    }
    else{
        //no attachments, skip the attachments step
        SOC_composeemailform_submit_0_5();
    }
        
        
}
/**
 * callback to be called after attachments are added to the email package
 * @returns {void}
 */
function SOC_composeemailform_submit_0_5(){
    SOC_log(5, 'SOC_composeemailform_submit_0_5', 'Enter');
    SOC_updateprogress('info','Finished creating the email package. Generating new random encryption key.');
    
    let socaes_encrypt = new SOC_AES_Encrypt();
    socglobal_datapackage_state.socaes_encrypt = socaes_encrypt;
    socaes_encrypt.generateKey(SOC_composeemailform_submit_1, SOC_composeemailform_submit_error_cb);
    
}
function SOC_composeemailform_submit_error_cb(error){
    SOC_log(5, 'SOC_composeemailform_submit_error_cb', 'Enter');
    SOC_updateprogress('error','Error sending email. See logs for details. Error: '+SOC_escapehtml(error));
    console.log(error);
    SOC_alert(error);
}
function SOC_composeemailform_submit_1(generatedkey){
    SOC_log(5, 'SOC_composeemailform_submit_1', 'Enter');
    SOC_updateprogress('info','Encrypting the message package.');
    SOC_datapackage_encrypt(socglobal_datapackage_state.socaes_encrypt, generatedkey, SOC_composeemailform_submit_2, SOC_composeemailform_submit_error_cb);
}
/**
 * called after the secure message package is encrypted and signed
 * now we will prepare the actual mime package and send it
 * @param {string} simple_secure_attachment base64 encoded
 * @param {string} signature_b64 base64 encoded
 * @param {Array} errors array
 * @returns {void}
 */
function SOC_composeemailform_submit_2(simple_secure_attachment, signature_b64, errors){
    SOC_log(5, 'SOC_composeemailform_submit_2', 'Enter');    
    SOC_updateprogress('info','Encrypted the message package. Now sending it');
    let subject = document.forms['composeemailform'].subject.value;
    let clearTextMessage_b64 = socglobal_base64.encodeString(document.forms['composeemailform'].clearTextMessage.value);

    let other_cc_recipients = document.forms['composeemailform'].otherrecipients.value;
    let cc_addresses = [];
    if(other_cc_recipients){
        for(let tmpothercc of other_cc_recipients.split(' ')){
            let tmptrimmedothercc = tmpothercc.trim();
            if(tmptrimmedothercc.length>0){
                cc_addresses.push(tmptrimmedothercc);
            }
        }
    }
    
    
    let recipients = [];
    for(let tmpemail in socglobal_composestate.recipients){
        recipients.push(tmpemail);
    }
    
    
    let attachments = {
        'simple-secure.message':{
            b64str: simple_secure_attachment,
            mime: SOC_SIMPLE_SECURE_MSG_MIME
        },
        'simple-secure.signature':{
            b64str: socglobal_base64.encodeString(signature_b64),   //we need to base64 encode it again, for email content transfer encoding
            mime: SOC_SIMPLE_SECURE_SIGNATURE_MIME
        }
    };
    let msgmime_str = SOC_emailmessage_create_with_attachments(clearTextMessage_b64, attachments, recipients, cc_addresses, subject);
    if(document.forms['composeemailform'].clickedsubmitbuttonvalue.value=='draft'){
        socglobal_providerclient.saveDraft(msgmime_str, SOC_composeemailform_submit_finished_savedraft, SOC_composeemailform_submit_savedraft_error_cb);
    }
    else{
        socglobal_providerclient.sendEmail(msgmime_str,SOC_composeemailform_submit_finished, SOC_composeemailform_submit_sendemail_error_cb);
    }
    
}
function SOC_composeemailform_submit_savedraft_error_cb(error){
    SOC_log(5, 'SOC_composeemailform_submit_savedraft_error_cb', 'Enter');
    SOC_updateprogress('error','Error saving email as draft. See logs for details. Error: '+SOC_escapehtml(error));

    SOC_alert(error);
}

function SOC_composeemailform_submit_finished_savedraft(response_fromprovider){
    SOC_log(5, 'SOC_composeemailform_submit_finished_savedraft', 'Enter'); 
    if(response_fromprovider && response_fromprovider.result && response_fromprovider.result.id){
        ////mail is saved. success. we made it  
        SOC_updateprogress('info','Email saved as draft. Message id= ' + response_fromprovider.result.id);
        ///now erase temporary state
        
        SOC_datapackage_init();
        SOC_composeemailform_reset();
    }
    else{
        SOC_updateprogress('info','Error saving draft. Response from email provider= ' + SOC_escapehtml(JSON.stringify(response_fromprovider.result)));
        SOC_alert('Error saving the draft. Please see logs for more details');
    }
}

/**
 * called after the email is sent 
 * @param {object} response_fromprovider google api response
 * @returns {void}
 */
function SOC_composeemailform_submit_finished(response_fromprovider){
    SOC_log(5, 'SOC_composeemailform_submit_finished', 'Enter'); 
    if(response_fromprovider && response_fromprovider.result && response_fromprovider.result.id){
        ////mail is sent. success. we made it  
        SOC_updateprogress('info','Email sent successfully. Message id= ' + response_fromprovider.result.id);
        ///now erase temporary state
        
        SOC_datapackage_init();
        SOC_composeemailform_reset();
    }
    else{
        SOC_updateprogress('info','Error sending the email. Response from email provider= ' + SOC_escapehtml(JSON.stringify(response_fromprovider.result)));
        SOC_alert('Error sending the email. Please see logs for more details');
    }
}

/**
 * called when sendEmail fails
 * @param {object} response_fromprovider google api response
 * @returns {void}
 */
function SOC_composeemailform_submit_sendemail_error_cb(response_fromprovider){
    SOC_log(5, 'SOC_composeemailform_submit_sendemail_error_cb', 'Enter'); 
    if(response_fromprovider && response_fromprovider.result && response_fromprovider.result.error){
        ////failed to send the email
        let errormsg = SOC_escapehtml(response_fromprovider.result.error.message);
        SOC_alert('Error sending the email. Please see logs for more details. Error message from Google is: ' + errormsg );        
        SOC_updateprogress('error','Error sending the email. Response from email provider= ' + SOC_escapehtml(JSON.stringify(response_fromprovider.result)));
    }
    else{
        SOC_updateprogress('error','Error sending the email. Response from email provider= ' + SOC_escapehtml(JSON.stringify(response_fromprovider.result)));
        SOC_alert('Error sending the email. Please see logs for more details');
    }
}
