/*
 * constants
 * see only the values marked with "//CONFIGURE THIS" comments
 */

//changing mime types may break interoperability with other instances
const SOC_MY_KEY_MIME_TYPE_PREFIX = 'application/vnd.sozkan.simple-secure.my';
const SOC_MY_PRIVATE_KEY_MIME_TYPE = SOC_MY_KEY_MIME_TYPE_PREFIX+'.privatekey';
const SOC_MY_PUBLIC_KEY_MIME_TYPE = SOC_MY_KEY_MIME_TYPE_PREFIX+'.publickey';
const SOC_CONTACT_KEY_MIME_TYPE = 'application/vnd.sozkan.simple-secure.contact.publickey';

const SOC_SIMPLE_SECURE_MSG_MIME = 'application/vnd.sozkan.simple-secure.message';
const SOC_SIMPLE_SECURE_SIGNATURE_MIME = 'application/vnd.sozkan.simple-secure.signature';


const SOC_GOOGLE_DISCOVERY_DOCS = [
                                "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
                                'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'
                             ];
//space separated scope values.            NOTE THE TRAILING SPACE CHARACTERS!
const SOC_GOOGLE_OAUTH_SCOPES =  'https://www.googleapis.com/auth/drive.file '+
                                    'https://www.googleapis.com/auth/gmail.send '+
                                    'https://www.googleapis.com/auth/gmail.readonly '+
                                    'https://www.googleapis.com/auth/gmail.modify';
/*
https://www.googleapis.com/auth/drive.file is required for google drive operations
https://www.googleapis.com/auth/gmail.send is required for sending emails
https://www.googleapis.com/auth/gmail.readonly is required for reading emails
https://www.googleapis.com/auth/gmail.modify is required for "save as draft" feature and for updating emails as "read"
*/
/**
 * do not change anything here if you are not sure
 * 
 */
///BEGIN GLOBAL VARIABLES
var socglobal_base64 = new SOC_base64();
var socglobal_loglevel = 5; //log levels are from 0 to 5. 0=no logging, 5=trace logging
var socglobal_issignedon = false;
//the google client - SOC_GoogleClient instance
var socglobal_providerclient = null;
var socglobal_currentuseremail = null;
//list of my keys (but not the actual keys)
var socglobal_mykeyslist = null;
//this is my private key. asking the user to reload it would be very inconvenient so we will keep it around. TODO consider security
var socglobal_myprivatekey = null;
var socglobal_myprivatekey_forsigning = null;
//we will use this one to verify signatures which were created by socglobal_myprivatekey_forsigning
var socglobal_mypublickey_forverifying = null;
//used to maintain state between async callbacks
var socglobal_stateobject = {};
//my contacts, cached in this var
var socglobal_mycontactslist = {};
//object for holding state while composing a new email
var socglobal_composestate = {recipients:{} /* email:cryptokey, ... */, attachments:[], subject:'', clearTextMessage:'', encryptedMessage:''};
//inbox loaded or not not yet loaded state
var socglobal_inboxrefreshed = false;
var socglobal_reademail_state = {keyforme:'', ivforme:'', entiresecuremessage:'', data:'', 
    aeskey_buffer:null /* decrypted clear text aes key*/, iv_buffer:null, 
    from_email:'' /* contact */, 
    mailid_at_provider: '',     //mail id. used to mark email as read
    tmp_blob_urls:[],   //blob objects for attachments
    contact_keyfile_json: null  /* the contact file for the sender downloaded from MY google drive. will be used for signature verification*/
};

var socglobal_datapackage={};
var socglobal_datapackage_data={};
var socglobal_datapackage_state={};

///END GLOBAL VARIABLES