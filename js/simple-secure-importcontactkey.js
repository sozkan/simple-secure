/* 
 * code specific to #importcontactkey
 */

/**
 * updates list of contacts loaded from the provider (google)
 * updates both the contacts page and the compose page in one loop so it's a bit messy
 * @returns {void}
 */
function SOC_contacts_loaded_cb(response){
    SOC_log(5, 'SOC_contacts_loaded_cb', 'Enter'); 
    SOC_updateprogress('info','Loaded contacts from Google drive');
    socglobal_mycontactslist = {};
    let myexistingcontactsdiv = SOC_gebi('myexistingcontactsdiv');
    let composeemailform_recipientsdiv = SOC_gebi('composeemailform_recipientsdiv');
    
    if(response.result && response.result.files && response.result.files.length>0){
        let htmlfor_contacts ='<table>';
        let htmlfor_compose = '<div id="composeemailform_recipientsdiv_table">';
        for(let tmpcontact of response.result.files){
            let tmpescapedemail = SOC_escapehtml(tmpcontact.properties.email);
            htmlfor_contacts+='<tr><td><span '+ 
                    //' style="cursor:pointer" onclick="SOC_startcomposing(\''+tmpescapedemail+'\')"'+
                    '>'+
                    SOC_escapehtml(tmpcontact.properties.email);
            htmlfor_contacts+='</span> <a target="_blank" href="'+SOC_escapehtml(tmpcontact.webViewLink)+'">View contact file</a>';
            htmlfor_contacts+='</td></tr>';
            
            //also update the global contacts list
            socglobal_mycontactslist[tmpcontact.properties.email] = tmpcontact.id;
            
            htmlfor_compose+='<div><button onclick="SOC_composeemailform_recipient_clicked(this, \''+tmpescapedemail+'\')">'+tmpescapedemail+'</button></div>';
        }
        htmlfor_contacts +='</table>';
        htmlfor_compose +='</table>';
        myexistingcontactsdiv.innerHTML = htmlfor_contacts;
        composeemailform_recipientsdiv.innerHTML = htmlfor_compose;
    }
    else{
        SOC_updateprogress('info','No contacts found in Google drive');
        let htmlstr ='<div class="informative-msg">You don\'t have any contacts. You can add a new contact by uploading their public key file.</div>';
        myexistingcontactsdiv.innerHTML=htmlstr;
        composeemailform_recipientsdiv.innerHTML = htmlstr;
    }
}


/**
 * called when add new contact form is submitted
 * @returns {void}
 */
function SOC_addnewcontactkeyform_submit(){
    SOC_log(5, 'SOC_addnewcontactkeyform_submit', 'Enter');
    SOC_updateprogress('info','Adding new contact');
    let fileinput = SOC_gebi('addnewcontactkeyfileinput');
    if(fileinput.files.length!=1){       
        SOC_updateprogress('warn','You did not select a contact key file, cannot continue');
        SOC_alert('Please select a .publickey file and click next');
        return;
    }
    let selected_file = fileinput.files[0];    
    let filereader = new FileReader();
    filereader.addEventListener('load', SOC_addnewcontactkeyform_submit_2_success);
    filereader.addEventListener('error', SOC_addnewcontactkeyform_submit_2_error);
    filereader.readAsText(selected_file);
    SOC_log(5, 'SOC_addnewcontactkeyform_submit', 'Exit');
}

/**
 * the user selected a file, viewed contact details and confirmed
 * at this stage the key data for the contact should be available in socglobal_stateobject.newcontactjson
 * we will concatenate encryption and signing attributes and sign the entire string
 * then upload it to google drive
 * @returns {void}
 */
function SOC_addnewcontactkey_confirmed(){
    SOC_log(5, 'SOC_addnewcontactkey_confirmed', 'Enter');
    SOC_updateprogress('info','Signing the new contact information using my own private key');
    let socrsassa = new SOC_RSASSA_PKCS1_v1_5();
    let str_to_sign = socglobal_stateobject.newcontactjson.email + socglobal_stateobject.newcontactjson.encryption + socglobal_stateobject.newcontactjson.signing;

    socrsassa.beginSign(socglobal_myprivatekey_forsigning, str_to_sign, SOC_addnewcontactkey_confirmed_1, SOC_addnewcontactkey_confirmed_error_cb);
}

/**
 * will be called from SOC_RSASSA_PKCS1_v1_5.beginSign
 * @returns {void}
 */
function SOC_addnewcontactkey_confirmed_1(signature_bytes){
    SOC_log(5, 'SOC_addnewcontactkey_confirmed', 'Enter');   
    SOC_updateprogress('info','Finished signing the new contact information. Saving the contact file to Google drive');
    socglobal_stateobject.newcontactjson.signature = socglobal_base64.encodeBytes(new Uint8Array(signature_bytes));
    //now we will save socglobal_stateobject.newcontactjson to google drive
    let contactfile_str = JSON.stringify(socglobal_stateobject.newcontactjson);
    socglobal_providerclient.addContact(contactfile_str, socglobal_stateobject.newcontactjson.email, SOC_addnewcontactkey_confirmed_2, SOC_addnewcontactkey_confirmed_error_cb);
}

/**
 * the contact is saved. let the user know and update the list of contacts
 * @param {object} response_fromprovider
 * @returns {void}
 */
function SOC_addnewcontactkey_confirmed_2(response_fromprovider){
    SOC_log(5, 'SOC_addnewcontactkey_confirmed_2', 'Enter');  
    
    if(response_fromprovider.result){
        SOC_updateprogress('info','Finished saving the contact file to Google drive');
        SOC_gebi('addnewcontactkeyform_filedetails').innerHTML= '';
        socglobal_providerclient.listContacts(SOC_contacts_loaded_cb, SOC_contacts_loaded_error_cb);
        SOC_alert('Saved contact');
    }
    else{
        SOC_updateprogress('error','Failed to save contact, please check logs');
        SOC_alert('Failed to save contact, please check logs');
    }
}



function SOC_addnewcontactkeyform_submit_2_success(filereader_event){
    SOC_log(5, 'SOC_addnewcontactkeyform_submit_2_success', 'Enter');    
    SOC_updateprogress('info','Finished reading the new contact file');
    
    try{
        let contactjson = JSON.parse(filereader_event.srcElement.result);
        //////TODO should we reset state here??
        socglobal_stateobject = {};
        socglobal_stateobject.newcontactjson = contactjson;
        let strtohash = contactjson.email + contactjson.encryption + contactjson.signing;
        SOC_sha256(strtohash, SOC_addnewcontactkeyform_submit_3, SOC_addnewcontactkeyform_submit_3_error_cb);
    }
    catch(exx){
        let filedetailsdiv = SOC_gebi('addnewcontactkeyform_filedetails');
        filedetailsdiv.innerHTML = 'Error reading the new contact file!';
        SOC_updateprogress('error','Error reading the new contact file');
        SOC_log(1, 'SOC_addnewcontactkeyform_submit_2_success', exx);
        SOC_alert('Error reading the selected file. Please select a valid .publickey file');
    }
    SOC_log(5, 'SOC_addnewcontactkeyform_submit_2_success', 'Exit');
}
/**
 * called after the contact keys are hashed
 * @returns {void}
 */
function SOC_addnewcontactkeyform_submit_3(hash_bytes){
    let manualcheckvalues = SOC_sha256_to_manualcheckvalues(hash_bytes);    
    let filedetailsdiv = SOC_gebi('addnewcontactkeyform_filedetails');
    filedetailsdiv.innerHTML = '<table>'+
            '<tr><td>Email</td><td>'+SOC_escapehtml(socglobal_stateobject.newcontactjson.email)+'</td></tr>'+
            '<tr><td>Generated</td><td>'+SOC_escapehtml(socglobal_stateobject.newcontactjson.generated)+'</td></tr>'+
            //'<tr><td>Encryption Key</td><td>'+SOC_escapehtml(contactjson.encryption)+'</td></tr>'+
            //'<tr><td>Signing Key</td><td>'+SOC_escapehtml(contactjson.signing)+'</td></tr>'+
            '<tr><td>Check sum 1:</td><td>'+(manualcheckvalues.checksum)+'</td></tr>'+
            '<tr><td>Check sum 2:</td><td>'+(manualcheckvalues.foursum)+'</td></tr>'+
            '<tr><td>Hash</td><td>'+SOC_escapehtml(manualcheckvalues.hash.join(' '))+'</td></tr>'+
            '</table>'+
            '<div class="input-sidenote">Normally you should compare entire Hash values, checksum 1 and 2 are just convenience methods, '+
            ' to make manual key verification process easier, when the checksums are received over another channel such as voice calls etc. '+
            'First compare checksum 1 values, if they don\'t match, then the key is invalid. If they match compare checksum 2 values '+
            ' if they don\'t match, the key is invalid. When both match, you must compare the entire hash value. ' +
            '</div>'+
            '<input type="button" onclick="SOC_addnewcontactkey_confirmed()" value="OK. I checked all values. Add this contact">';
    
}
function SOC_addnewcontactkeyform_submit_3_error_cb(error){
    let logstr = SOC_escapehtml(JSON.stringify(error));
    let filedetailsdiv = SOC_gebi('addnewcontactkeyform_filedetails');
    filedetailsdiv.innerHTML = 'Error calculating check sum and hash values for the new contact file!';
    SOC_updateprogress('error','Error calculating check sum and hash values for the new contact file! Error:' + logstr);
    SOC_log(1, 'SOC_addnewcontactkeyform_submit_3_error_cb', logstr);        
}




/**
 * TODO fix
 * @param {type} response
 * @returns {undefined}
 */
function SOC_contacts_loaded_error_cb(response){
    let responsestrforlog = SOC_escapehtml(JSON.stringify(response));
    SOC_log(1, 'SOC_contacts_loaded_error_cb','Error:' + responsestrforlog);
    SOC_updateprogress('error', 'Error loading contacts');
    let d = SOC_gebi('myexistingcontactsdiv');
    d.innerHTML = '<div class="error-msg">Error loading contacts, please check logs for more details</div>';
}

function SOC_addnewcontactkey_confirmed_error_cb(error){
    let responsestrforlog = SOC_escapehtml(JSON.stringify(response));
    SOC_log(1, 'SOC_addnewcontactkey_confirmed_error_cb', 'Error adding contact. Error:' + responsestrforlog);
    SOC_updateprogress('error', 'Error adding contact');
    SOC_alert('Error creating new contact:' + responsestrforlog);
}

/**
 * 
 * @param {object} filereader_event
 * @returns {void}
 */
function SOC_addnewcontactkeyform_submit_2_error(filereader_event){
    let strforlog = SOC_escapehtml(JSON.stringify(filereader_event));
    SOC_log(1, 'SOC_addnewcontactkeyform_submit_2_error', 'Error reading contact file. Error:' +strforlog);
    SOC_updateprogress('error', 'Error reading contact file');
    let filedetailsdiv = SOC_gebi('addnewcontactkeyform_filedetails');
    
    filedetailsdiv.innerHTML = 'Error reading input file! (See logs for error details)';
    
    SOC_log(5, 'SOC_addnewcontactkeyform_submit_2_error', 'Exit');
}