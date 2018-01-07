/* 
 */

    
function SOC_emailmessage_prepare_to_string(recipients){
    let tostring = '';
    if(recipients){
        tostring = recipients.join(',');
    } 

    return tostring+'\n';
}
    
/**
 * recipients [name<email>, email, ...}
 */
/**
 * returns a text-plain email with attachments
 * typically an email will contain 2 attachments named simple-secure.zip and simple-secure.signature
 * @param string contents_b64encoded email body contents- WILL BE SENT IN CLEAR TEXT
 * @param object attachments {'filename':'file as base64encoded string', ...}
 * @param array recipients like '[name<email>, email, ...}'
 * @param array other recipients. keys won't be added for these recipients. they wont be able to read secure contents
 * @param string subject
 * @returns string
 */
function SOC_emailmessage_create_with_attachments(contents_b64encoded, attachments, recipients, cc_addresses, subject){        
    let boundary = 'boundary' + SOC_hexEncode(SOC_getRandomBytes(20));
    let tostring = 'To: '+ SOC_emailmessage_prepare_to_string(recipients);
    let ccstring = '';
    let merged_ccstring = SOC_emailmessage_prepare_to_string(cc_addresses);
    if(merged_ccstring){
        ccstring = 'Cc: '+ merged_ccstring;
    }
    
    let mimemsg = "MIME-Version: 1.0\n" +
                tostring+
                ccstring+
                "Subject: =?utf-8?B?" + socglobal_base64.encodeString(subject) + '?=\n'+ 

                "Content-Type: multipart/mixed; boundary=" + boundary + "\n\n"+
                "--" + boundary + "\n"+
                "Content-Type: text/plain; charset=UTF-8\n"+
                "Content-Transfer-Encoding: base64\n\n"+
                contents_b64encoded+"\n";

        for(let filename in attachments){
            SOC_log(5, 'SOC_emailmessage_create_with_attachments', 'Adding attachment '+filename);
            mimemsg+="--" + boundary + "\n" +
                "Content-Type: "+(attachments[filename].mime)+"; charset=\"UTF-8\"; name="+filename+"\n"+
                'Content-Disposition: attachment; filename="'+filename+"\"\n"+
                "Content-Transfer-Encoding: base64\n\n"+
                attachments[filename].b64str+"\n";
        }
        mimemsg+= "--"+boundary+"--";
    return mimemsg;
}

/**
 * create a simple text/html email  with only a google drive link to the 
 * encrypted file
 */
function SOC_emailmessage_create_with_driveLink(googledrivelink, subject, recipients){
    //TODO consider adding more info to the message?
    let msgbody = googledrivelink;
    let msgbody_b64 = socglobal_base64.encodeString(msgbody);

    let msg = 'From: Me <me@gmail.com>\n' +         
    SOC_emailmessage_prepare_to_string(recipients) +
    "Subject: =?utf-8?B?" + socglobal_base64.encodeString(subject) + '?=\n'+ 
    'Content-Type: text/plain; charset=utf-8\n' +
    'Content-Transfer-Encoding: base64\n\n' +
    msgbody_b64;
    return msg;
}
    
    
