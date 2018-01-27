/* 
 * google client
 * all code for handling google storage/transport implementation
 */

/**
 * 
 * @returns void
 */
function SOC_gapi_handleclientload() {
    socglobal_providerclient=new SOC_GoogleClient(); 
    gapi.load('client:auth2', function(){
                                    SOC_gapi_initclient();
                                });
}

/**
*  Initializes the API client library and sets up sign-in state
*  listeners.
*/
function SOC_gapi_initclient() {        
    gapi.client.init({
        apiKey: SOC_GOOGLE_API_KEY,
        clientId: SOC_GOOGLE_CLIENT_ID,
        discoveryDocs: SOC_GOOGLE_DISCOVERY_DOCS,
        scope: SOC_GOOGLE_OAUTH_SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(SOC_gapi_signin_callback);

        // Handle the initial sign-in state.
        /////////thatobj.signInCallback(thatobj, gapi.auth2.getAuthInstance().isSignedIn.get());
    }).catch(error=>{
        SOC_log(1, 'SOC_GoogleClient.initClient', error);
    });
}

function SOC_gapi_signin(){
    let authinstance = gapi.auth2.getAuthInstance();
    if(authinstance!=null){
        SOC_log(5, 'SOC_gapi_signin','Google auth instance is not null, calling sign in');
        authinstance.signIn().then(googleuser=>{
            //SOC_log(5, 'SOC_gapi_signin','Google user=' + JSON.stringify(googleuser));
            SOC_gapi_signin_callback(true);
        }).catch(error=>{
            SOC_log(1, 'SOC_gapi_signin','Error in promise =' + JSON.stringify(error));
            SOC_gapi_signin_callback(false);
        });
    }
    else{
        SOC_log(1, 'SOC_gapi_signin', 'Google auth instance is null');
    }
}
/**
 * https://developers.google.com/identity/sign-in/web/reference#googleauthissignedinlistenlistener
 * A function that takes a boolean value. listen() passes true to this function when the user signs in, and false when the user signs out. 
 */
function SOC_gapi_signin_callback(issignedin){
    if(issignedin){        
        SOC_set_signon_state(true);  
        SOC_log(4, 'SOC_gapi_signin_callback', 'Signed in to Google'); 
        socglobal_providerclient.getMyEmailAddress(SOC_set_currentuseremail);
        socglobal_providerclient.listContacts(SOC_contacts_loaded_cb, SOC_contacts_loaded_error_cb);
        window.location.hash='#mykeys';
    }
    else{
        SOC_set_signon_state(false);  
        SOC_log(1, 'SOC_gapi_signin_callback', 'Failed to sign in to Google or just logged out');
    }
}

function SOC_gapi_signout(){
    SOC_log(4, 'SOC_gapi_signout', 'Signing out'); 
    gapi.auth2.getAuthInstance().signOut();  
    SOC_set_signon_state(false);  
}


class SOC_GoogleClient extends SOC_Base{
    constructor(){
        super();
        this.labels_cache_loaded = false;
        this.labels_cache = {}; //used for caching users labels
    }
    


    sendEmail(emailcontents_str, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.sendEmail', 'Enter'); 
        let b64url = new SOC_base64URL();
        let base64UrlEncodedEmail = b64url.encodeString(emailcontents_str);
        gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'resource': {
                'raw': base64UrlEncodedEmail
            }
        }).then(
                function(response){
                    finished_callback(response);
                },
                function(response){
                    error_callback(response);
                }
                );
        
        SOC_log(5, 'SOC_GoogleClient.sendEmail', 'Exit'); 
    }

    /**
     * 
     * @param {string} emailcontents_str full email source as string
     * @param {function} finished_callback to be called when done
     * @returns void
     */
    saveDraft(emailcontents_str, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.saveDraft', 'Enter'); 
        let b64url = new SOC_base64URL();
        let base64EncodedEmail = b64url.encodeString(emailcontents_str);
        gapi.client.gmail.users.drafts.create({
            'userId': 'me',
            'resource': {
                'message': {
                    'raw': base64EncodedEmail
                }
            }
        }).then(
                function(response){
                    finished_callback(response);
                },
                function(response){
                    error_callback(response);
                }
                );
        SOC_log(5, 'SOC_GoogleClient.saveDraft', 'Exit');     
    }
    
    getMyEmailAddress(finished_callback){
        SOC_log(5, 'SOC_GoogleClient.getMyEmailAddress', 'Enter'); 
        var request = gapi.client.gmail.users.getProfile({
            'userId': 'me'
        });
        request.execute(finished_callback);
        SOC_log(5, 'SOC_GoogleClient.getMyEmailAddress', 'Exit'); 
    }
    
    /*
     * simple-secure-keys-folder
    *   - my 
    *      - private
    *      - public
    *   - contacts (public keys of contacts)
     */
    listMyKeys(finished_callback){
        SOC_log(5, 'SOC_GoogleClient.listMyKeys', 'Enter'); 
        var request = gapi.client.drive.files.list({
            'orderBy': 'name',
            'fields': 'files(name,properties(keyname),id,mimeType,webViewLink)',
            //'q': "mimeType contains '"+SOC_MY_KEY_MIME_TYPE_PREFIX+"' and trashed = false"
            'q': "mimeType = '"+SOC_MY_PRIVATE_KEY_MIME_TYPE+"' and trashed = false"
        });
        request.execute(finished_callback);
        SOC_log(5, 'SOC_GoogleClient.listMyKeys', 'Exit');         
    }
    
    savePrivateKey(privatekey_json_str, keyname, finished_callback){
        SOC_log(5, 'SOC_GoogleClient.savePrivateKey', 'Enter'); 
        const boundary = '-------'+SOC_hexEncode(SOC_getRandomBytes(20));
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        var fileContent = privatekey_json_str;

        var metadata = {
            //TODO we don't create folders since we don't care about file names etc. we only care about mime types
            //users can move files around if they want to
            'name': 'simple-secure_my-privatekey_'+keyname+'.privatekey',
            'properties': {'keyname':keyname},
            'mimeType': SOC_MY_PRIVATE_KEY_MIME_TYPE + '\r\n\r\n'
        };

        var multipartRequestBody = delimiter +  'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter +
                'Content-Type: ' + SOC_MY_PRIVATE_KEY_MIME_TYPE+ '\r\n\r\n' + fileContent + close_delim;

        let request = gapi.client.request({
            'path': '/upload/drive/v3/files',
            'method': 'POST',
            'params': {
                'uploadType': 'multipart'
            },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        }).then(
                function(response){
                   finished_callback(response); 
                }
           );            
        
        SOC_log(5, 'SOC_GoogleClient.savePrivateKey', 'Exit');                 
    }
    
    savePublicKey(publickey_json_str, keyname, finished_callback){
        SOC_log(5, 'SOC_GoogleClient.savePublicKey', 'Enter'); 
        const boundary = '-------728373787832sozkan61209dhjk219001829891';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        var fileContent = publickey_json_str;

        var metadata = {
            //TODO we don't create folders since we don't care about file names etc. we only care about mime types
            //users can move files around if they want to
            'name': 'simple-secure_my_publickey_'+keyname+'.publickey',
            'mimeType': SOC_MY_PUBLIC_KEY_MIME_TYPE + '\r\n\r\n'
        };

        var multipartRequestBody = delimiter +  'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter +
                'Content-Type: ' + SOC_MY_PUBLIC_KEY_MIME_TYPE+ '\r\n\r\n' + fileContent + close_delim;

        let request = gapi.client.request({
            'path': '/upload/drive/v3/files',
            'method': 'POST',
            'params': {
                'uploadType': 'multipart'
            },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        }).then(
                function(response){
                   finished_callback(response); 
                }
           );     
        
        SOC_log(5, 'SOC_GoogleClient.savePrivateKey', 'Exit');                 
    }

    
    /**
     * downloads the given file 
     * TODO why is it parsing and returning file contents as json?? investigate
     * @param {string} fileId
     * @returns void
     */
    downloadFile(fileId, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.downloadFile', 'Enter'); 
        gapi.client.drive.files.get({
                'fileId':fileId,
                'alt':'media'
        }).then(
                function(response){                    
                    finished_callback(fileId, response); 
                },
                function(response){
                    error_callback(response);
                }
                );
        SOC_log(5, 'SOC_GoogleClient.downloadFile', 'Exit');          
    }
    
    /**
     * shares the given file with anyone 
     * @param {string} fileId
     * @returns void
     */
    sharePublicKeyFile(fileId, finished_callback){
        SOC_log(5, 'SOC_GoogleClient.sharePublicKeyFile', 'Enter'); 
        var request = gapi.client.request({
                'path': '/drive/v3/files/' + fileId + '/permissions',
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body':{
                     'role': 'reader', 
                     'type': 'anyone'
                }
        }).then(
                function(response){
                    finished_callback(fileId, response); 
                }
                );
        SOC_log(5, 'SOC_GoogleClient.sharePublicKeyFile', 'Exit');          
    }
    
    /**
     * does not share the file. only returns the sharable link for the file 
     * if it's already shared
     * @param {string} fileId
     * @param {function} finished_callback function to be called when finished
     * @returns void
     */
    getSharableLinkForFile(fileId, finished_callback){
        SOC_log(5, 'SOC_GoogleClient.getSharableLinkForFile', 'Enter'); 
        var request = gapi.client.request({
                'path': '/drive/v3/files/' + fileId ,
                'method': 'GET',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'params':{
                     'fields': 'webContentLink,webViewLink', 
                }
        }).then(
                function(response){
                    finished_callback(fileId, response); 
                }
                );
        SOC_log(5, 'SOC_GoogleClient.getSharableLinkForFile', 'Exit');                  
    }
    
    /**
     * saves contact file
     * @param {string} signed_contactfile_str
     * @param {string} contact_email
     * @param {function} finished_callback
     * @param {function} error_callback
     * @returns {void}
     */
    addContact(signed_contactfile_str, contact_email, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.addContact', 'Enter'); 
        const boundary = '-------' + SOC_hexEncode(SOC_getRandomBytes(20));
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";        

        var metadata = {
            //TODO we don't create folders since we don't care about file names etc. we only care about mime types
            //users can move files around if they want to
            'name': 'simple-secure_contact-publickey_'+contact_email+'.publickey',
            'properties': {'email':contact_email},
            'mimeType': SOC_CONTACT_KEY_MIME_TYPE + '\r\n\r\n'
        };

        var multipartRequestBody = delimiter +  'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter +
                'Content-Type: ' + SOC_CONTACT_KEY_MIME_TYPE+ '\r\n\r\n' + signed_contactfile_str + close_delim;

        gapi.client.request({
            'path': '/upload/drive/v3/files',
            'method': 'POST',
            'params': {
                'uploadType': 'multipart'
            },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        }).then(
                function(response){
                   finished_callback(response); 
                }
           );            
        
        SOC_log(5, 'SOC_GoogleClient.addContact', 'Exit');          
    }
    
    /**
     * loads list of contacts from google drive
     * @param {function} finished_callback
     * @param {function} error_callback
     * @returns {void}
     */
    listContacts(finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.listContacts', 'Enter'); 
        gapi.client.drive.files.list({
            'orderBy': 'name',
            'fields': 'files(name,id, properties(email),webViewLink)',
            'q': "mimeType = '"+SOC_CONTACT_KEY_MIME_TYPE+"' and trashed = false "
        }).then(
                function(response){
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }

        );
        SOC_log(5, 'SOC_GoogleClient.listContacts', 'Exit');         
    }
    
    /**
     * 
     * @param {type} finished_callback
     * @param {type} error_callback
     * @returns {undefined}
     */
    listLabels(finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.listLabels', 'Enter'); 
        gapi.client.gmail.users.labels.list({
        'userId': 'me'
        }).then(
                function(response){
                    finished_callback(response);
                },
                function(response){
                    error_callback(response);
                }
                );
        this.labels_cache_loaded = true;
        SOC_log(5, 'SOC_GoogleClient.listLabels', 'Exit'); 
    }

    /*
     * 
     * 
     */
    listEmails(filter_str, page_id, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.listEmails', 'Enter'); 
        let query = 'has:attachment filename:simple-secure.message  ';
        if(filter_str){
            query+=filter_str;
        }
        gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'q': query,
            'maxResults': 20
        })
        .then(
                function(response){                    
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }

        );
        SOC_log(5, 'SOC_GoogleClient.listEmails', 'Exit');         
    }

    /**
     * only gets metadata for inbox listing
     * @param {type} mailid
     * @param {type} finished_callback
     * @param {type} error_callback
     * @returns {undefined}
     */
    getEmailInfo(mailid, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.getEmailInfo', 'Enter'); 
        
        gapi.client.gmail.users.messages.get({
            'userId': 'me',
            'id': mailid,
            'format': 'metadata'
        })
        .then(
                function(response){                    
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }

        );
        SOC_log(5, 'SOC_GoogleClient.getEmailInfo', 'Exit');         
    }
    
    loadMail(mailid, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.loadMail', 'Enter'); 
        
        gapi.client.gmail.users.messages.get({
            'userId': 'me',
            'id': mailid,
            'format': 'full'
        })
        .then(
                function(response){                    
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }

        );
        SOC_log(5, 'SOC_GoogleClient.loadMail', 'Exit');         
    }

    /**
     * downloads an attachment
     * @param {type} messageid
     * @param {type} attachmentid
     * @returns {undefined}
     */
    downloadEmailAttachment(messageid, attachmentid, finished_callback, error_callback){
      gapi.client.gmail.users.messages.attachments.get({
        'id': attachmentid,
        'messageId': messageid,
        'userId': 'me'
      }).then(
                function(response){                    
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }
                
            );

    }
    
    
    markEmailAsRead(mailid, finished_callback, error_callback) {
        gapi.client.gmail.users.messages.modify({
            'userId': 'me',
            'id': mailid,
            'addLabelIds': [],
            'removeLabelIds': ['UNREAD']
        })
        .then(
                function (response) {
                    finished_callback(response);
                },
                function (response) {
                    error_callback(response);
                }

        );

    }
     
    /**
     * search for files in google drive
     * TODO returns max 20 results and does not support paging, yet
     * TODO add support for other parameters (e.g includeTeamDriveItems) documented at https://developers.google.com/drive/v3/reference/files/list
     * TODO add proper sorting support
     * @param {function} finished_callback
     * @param {function} error_callback
     * @returns {void}
     */
    searchFilesInDrive(filterquery_str, finished_callback, error_callback){
        SOC_log(5, 'SOC_GoogleClient.searchFilesInDrive', 'Enter'); 
        let qparam = "mimeType = '"+SOC_SIMPLE_SECURE_ENCRYPTED_FILE+"'";
        if(filterquery_str){
            qparam +=" and " + filterquery_str;
        }
        gapi.client.drive.files.list({
            'orderBy': 'name',
            'pageSize':20,
            
            /*
             * TODO retrive additional fields like 
                "sharingUser": {"kind": "drive#user", "displayName": string, "photoLink": string, "me": boolean, "permissionId": string, "emailAddress": string},
                "owners": [{"kind": "drive#user", "displayName": string, "photoLink": string, "me": boolean, "permissionId": string, "emailAddress": string}  ],
                "teamDriveId": string,
             */
            'fields': 'files(name,id, createdTime, modifiedTime, trashed, starred, properties(originalMimeType),webViewLink, webContentLink)',
            'q': qparam
        }).then(
                function(response){
                    finished_callback(response); 
                },
                function(response){
                    error_callback(response); 
                }

        );
        SOC_log(5, 'SOC_GoogleClient.searchFilesInDrive', 'Exit');         
    }

    /**
     * save (create or update) a file in google drive
     * @param {string} file_id
     * @param {string} filecontents_str
     * @param {string} filename
     * @param {string} original_mimetype
     * @param {function} finished_callback
     * @param {function} error_callbak
     * @returns {void}
     */
    saveFile(file_id, filecontents_str, filename, original_mimetype, finished_callback, error_callbak){
        SOC_log(5, 'SOC_GoogleClient.saveFile', 'Enter'); 
        const boundary = '-------'+SOC_hexEncode(SOC_getRandomBytes(20));
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        

        let metadata = {
            //we don't create folders since we don't care about file names etc. we only care about mime types
            //users can move files around if they want to
            'name': filename,
            'properties': {'originalMimeType':original_mimetype},
            'mimeType': SOC_SIMPLE_SECURE_ENCRYPTED_FILE + '\r\n\r\n'
        };

        var multipartRequestBody = delimiter +  'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter +
                'Content-Type: ' + SOC_SIMPLE_SECURE_ENCRYPTED_FILE+ '\r\n\r\n' + filecontents_str + close_delim;

        let method = 'POST';
        if(file_id){    //updating an existing file
            method = 'PATCH';
        }
        let apipath = '/upload/drive/v3/files';
        if(file_id){    //updating an existing file
            apipath = apipath+'/'+file_id;
        }

        gapi.client.request({
            'path': apipath,
            'method': method,
            'params': {
                'uploadType': 'multipart'
            },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        }).then(
                function(response){
                   finished_callback(response); 
                },
                function(response){
                    error_callbak(response);
                }
           );            
        
        SOC_log(5, 'SOC_GoogleClient.saveFile', 'Exit');                 
    }
}


    