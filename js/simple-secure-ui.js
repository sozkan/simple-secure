/* 
 * stuff for managing UI transitions etc
 */

function SOC_gebi(elemid){
    return document.getElementById(elemid);
}

/**
 * called on body.onload
 * @returns void
 */
function SOC_body_onload(){
    //handle navigation events
    window.onhashchange = function(){
        SOC_switch_uistate(decodeURI(window.location.hash));
    };
    //close the fullscreen alert if it's visible
    window.onkeydown = function(evt){
        if (evt.keyCode == 27) {
            let alertdiv = SOC_gebi('fullscreenalertdiv');
            if(alertdiv.style.display!='none'){
                SOC_alert_close();
            }
        }
    }
    //global default error handler for unhandled events
    window.onerror = function(theerror){
        SOC_log(1, 'window.onerror', theerror);
        SOC_updateprogress('error', 'Unhandled error caught: '+ SOC_escapehtml(theerror));
    }
    SOC_switch_uistate(decodeURI(window.location.hash));
    SOC_set_signon_state(socglobal_issignedon);
}


/**
 * appends a status update message
 * @param {string} msgtype
 * @param {string} msg
 * @returns {void}
 */
function SOC_updateprogress(msgtype, msg){
   let textarea = SOC_gebi('progressupdatediv_textarea');
   textarea.value += new Date().toISOString()+'\t'+msgtype+'\t'+msg+'\n';
    if(socglobal_longoperation_in_progress){
        let msgdiv = SOC_gebi('fullscreenalertdiv_msgbox_msg');
        let newdiv = document.createElement('div');
        newdiv.innerHTML = msg;
        newdiv.setAttribute('class', msgtype);
        msgdiv.appendChild(newdiv);
    }
}

/**
 * log 
 * @param {int} level 1=error, 4=info, 5=debug
 * @param {string} from
 * @param {string} msg
 * @returns {void}
 */
function SOC_log(level, from, msg){
    if(level<=socglobal_loglevel){
        //console.log(from+'  '+JSON.stringify(msg));
        SOC_updateprogress('Log-' + level, from+':'+ msg);
    }
}
/**
 * TODO needs to be improved
 * html encoding
 * @returns {string}
 */
function SOC_escapehtml(str){
    if(!str || str.length<1){
        return str;        
    }
    let tmpdiv = document.createElement('div');
    tmpdiv.appendChild(document.createTextNode(str));
    let rv = tmpdiv.innerHTML;
    return rv.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/**
 * @param {string} snippetid id of an element in templates section (view source) 
 * @param {boolean} writetopage if true write to page using document.write, otherwise return the html
 */
function SOC_includesnippet(snippetid, writetopage){
    let sourceelement = SOC_gebi(snippetid);
    if(writetopage){
        document.write(sourceelement.innerHTML);
    }
    else{
        return sourceelement.innerHTML;
    }
}


function SOC_switch_uistate(locationhash){
    SOC_log(4, 'SOC_switch_uistate', 'Switching to state:' + locationhash);
    
    //not logged in. so assume logged out
    if(!socglobal_issignedon && locationhash!='#logout'){
        SOC_log(2, 'SOC_switch_uistate', 'NOT LOGGED IN');
        window.location.hash='#logout';
        return;
    }
    if(socglobal_issignedon && locationhash=='#logout'){
        SOC_gebi('maincontainer').style.display='none';
        SOC_gebi('myexistingkeypairsdiv').style.display='none';
        SOC_gebi('generatekeydiv').style.display='none';
        SOC_gebi('importcontactkeydiv').style.display='none';
        SOC_gebi('composediv').style.display='none';
        SOC_gebi('inboxdiv').style.display='none';        
        SOC_gebi('reademaildiv').style.display='none';            
        SOC_gebi('loginbuttonsdiv').style.display='';            
        SOC_gebi('progressupdatediv').style.display='none';  
        SOC_gebi('filesdiv').style.display='none';          
        SOC_gebi('edittextfilediv').style.display='none';          
        SOC_gebi('editbinaryfilediv').style.display='none';
        SOC_gebi('viewbinaryfilediv').style.display='none';          
        SOC_log(4, 'SOC_switch_uistate', 'Signing out');
        SOC_sign_out();
        return;
    }
    switch(locationhash){ 
        case '#addtextfile':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            SOC_files_edittextfileform_reset();
            //SOC_gebi('edittextfileform_filecontents').style.height=window.innerHeight/2;
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none'; 
            SOC_gebi('edittextfilediv').style.display=''; 
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#addbinaryfile':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            SOC_files_editbinaryfileform_reset();
            //SOC_gebi('edittextfileform_filecontents').style.height=window.innerHeight/2;
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none'; 
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='';
        break;
        case '#editbinaryfile':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            //SOC_gebi('edittextfileform_filecontents').style.height=window.innerHeight/2;
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none'; 
            SOC_gebi('edittextfilediv').style.display='none'; 
            SOC_gebi('editbinaryfilediv').style.display='';
        break;
        case '#edittextfile':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            //SOC_gebi('edittextfileform_filecontents').style.height=window.innerHeight/2;
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none'; 
            SOC_gebi('edittextfilediv').style.display=''; 
            SOC_gebi('editbinaryfilediv').style.display='none';
        break;
        case '#files':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            if(!socglobal_fileslistloaded){     //files list is being loaded for the first time
                SOC_files_filterform_submit();
                socglobal_fileslistloaded = true;
            }
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='';  
            SOC_gebi('edittextfilediv').style.display='none'; 
            SOC_gebi('editbinaryfilediv').style.display='none';
        break;
        case '#mykeys':    
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none';
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none';  
            SOC_gebi('filesdiv').style.display='none'; 
            SOC_gebi('edittextfilediv').style.display='none'; 
            SOC_gebi('editbinaryfilediv').style.display='none';
            SOC_myexistingkeypairsdiv_render();
            break;
        case '#logs':            
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none';
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='';     
            SOC_gebi('filesdiv').style.display='none';    
            SOC_gebi('edittextfilediv').style.display='none'; 
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#generatekey':            
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none';
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';     
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#importcontactkey':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            socglobal_providerclient.listContacts(SOC_contacts_loaded_cb, SOC_contacts_loaded_error_cb);            
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none';
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';  
            SOC_gebi('edittextfilediv').style.display='none';   
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#compose':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';  
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#inbox':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            ///load inbox if it's not yet loaded.
            if(!socglobal_inboxrefreshed){
                SOC_inbox_listemails();
            }
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='';   
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';   
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#reademail':
            if(!socglobal_myprivatekey){
                SOC_alert('You MUST load your key first');
                window.location.hash='#mykeys';
                return;
            }
            SOC_gebi('maincontainer').style.display='';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none';   
            SOC_gebi('reademaildiv').style.display='';            
            SOC_gebi('loginbuttonsdiv').style.display='none';
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';  
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
        case '#logout':
        default:
            SOC_gebi('maincontainer').style.display='none';
            SOC_gebi('myexistingkeypairsdiv').style.display='none';
            SOC_gebi('generatekeydiv').style.display='none';
            SOC_gebi('importcontactkeydiv').style.display='none';
            SOC_gebi('composediv').style.display='none';
            SOC_gebi('inboxdiv').style.display='none'; 
            SOC_gebi('reademaildiv').style.display='none';            
            SOC_gebi('loginbuttonsdiv').style.display='';            
            SOC_gebi('progressupdatediv').style.display='none'; 
            SOC_gebi('filesdiv').style.display='none';   
            SOC_gebi('edittextfilediv').style.display='none';
            SOC_gebi('editbinaryfilediv').style.display='none';
            break;
    }
}

/**
 * Updates the email address for the current user (top left corner of the screen)
 * @param {object} userprofileresponse
 * @returns {void}
 */
function SOC_set_currentuseremail(userprofileresponse){
    socglobal_currentuseremail = userprofileresponse.emailAddress;
    SOC_gebi('currentuseremailspan').innerHTML = SOC_escapehtml(socglobal_currentuseremail);
}

/**
 * full screen alert overlay
 * @param {string} msg may contain html
 * @returns {void}
 */
function SOC_alert(msg){
    SOC_end_longoperation();    //an alert will signal the end of a long operation
    let msgdiv = SOC_gebi('fullscreenalertdiv_msgbox_msg');
    msgdiv.innerHTML = msg;
    
    let alertdiv = SOC_gebi('fullscreenalertdiv');
    alertdiv.style.display='';
    //alert(msg);
}

/**
 * hide the full screen alert overlay
 * @returns {void}
 */
function SOC_alert_close(){
    let alertdiv = SOC_gebi('fullscreenalertdiv');
    alertdiv.style.display='none';    
}

/**
 * sign in with google (for now)
 * @returns {void}
 */
function SOC_sign_in(){
    SOC_gapi_signin();
}

/**
 * sign out
 * and delete global variables (in case the user doesn't close the window)
 */
function SOC_sign_out(){
    console.log('SOC_sign_out');
    SOC_gapi_signout();
    //////////destroy global variables. 
    //Deleting all variables starting with socglobal_ was the plan but then  
    //the page needs to be reloaded before signing in again. 
    //TODO review if deleting everything including gapi would be safer (will be more inconvenient though)
    delete window.socglobal_currentuseremail;
    delete window.socglobal_mykeyslist;
    delete window.socglobal_myprivatekey;
    delete window.socglobal_myprivatekey_forsigning;
    delete window.socglobal_mypublickey_forverifying;
    delete window.socglobal_mypublickey_forencryption;
    delete window.socglobal_stateobject;
    delete window.socglobal_mycontactslist;
    delete window.socglobal_composestate;
    delete window.socglobal_inboxrefreshed;
    delete window.socglobal_datapackage;
    delete window.socglobal_datapackage_data;
    delete window.socglobal_datapackage_state;
    SOC_reademail_cleanup_state();
    
    delete window.socglobal_reademail_state;
    delete window.socglobal_fileedit_state;
    SOC_files_cleanup_state();
    delete window.socglobal_files_state;
    
    
    ///reloading the page to force deletion of data
    window.location.reload();
}

function SOC_reademail_cleanup_state(){
    if(socglobal_reademail_state && socglobal_reademail_state.tmp_blob_urls){
        for(let tmpbloburltodelete of socglobal_reademail_state.tmp_blob_urls){
            window.URL.revokeObjectURL(tmpbloburltodelete);
        }
    }    
}

function SOC_set_signon_state(issignedon){
    socglobal_issignedon = issignedon;
    if(issignedon){
        SOC_gebi('loginbuttonsdiv').style.display='none';            
        SOC_gebi('navigation').style.display='';     
    }
    else{
        SOC_gebi('loginbuttonsdiv').style.display='';            
        SOC_gebi('navigation').style.display='none';                    
        window.location.hash = '#logout';
    }
}


function SOC_progressupdatediv_textarea_copy(){
    SOC_gebi('progressupdatediv_textarea').select();
    document.execCommand('copy');
}

/**
 * called when beginning a long operation 
 * e.g you click a button and a lot of things happen in sequence
 * shows the fullscreen progress update window
 */
function SOC_begin_longoperation(){
    socglobal_longoperation_in_progress = true;
    let msgdiv = SOC_gebi('fullscreenalertdiv_msgbox_msg');
    msgdiv.innerHTML = '';
    
    let alertdiv = SOC_gebi('fullscreenalertdiv');
    alertdiv.style.display='';

}

/**
 * called when a long operation ends
 * hides the fullscreen progress update window
 */
function SOC_end_longoperation(){
    socglobal_longoperation_in_progress = false;
    SOC_alert_close();
}

function SOC_showhide_help(helpdivid){
    let helpdiv = SOC_gebi(helpdivid);
    if(helpdiv.style.display=='none'){
        helpdiv.style.display='';
    }
    else{
        helpdiv.style.display='none';
    }
}