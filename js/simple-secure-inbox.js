/* 
 * code for #inbox
 */

/**
 * called when email details are retrieved from gmail api
 * @param {type} response_fromprovider
 * @returns {undefined}
 */
function SOC_inbox_emaildetails_cb(response_fromprovider){
    SOC_log(5, 'SOC_inbox_emaildetails_cb', 'Enter');

    let divforemail = SOC_gebi('email_'+response_fromprovider.result.id);
    
    ///now we will fill these headers
    let emailheaders = SOC_inbox_parseemailheaders(response_fromprovider);
    //divforemail.innerHTML = SOC_escapehtml(JSON.stringify(response_fromprovider));
    let generatedhtml = '';
    if(emailheaders.subject){
        generatedhtml+='<div class="email-subject">'+SOC_escapehtml(emailheaders.subject)+'</div>';
    }
    else{
        generatedhtml+='<div class="email-subject">[No Subject]</div>';        
    }
    let labels_str = '';
    for(let tmplabelid of response_fromprovider.result.labelIds){
        labels_str += '<span class="email-label '+(SOC_escapehtml(tmplabelid))+'">' + socglobal_providerclient.labels_cache[tmplabelid] + '</span>';
    }
    generatedhtml+='<div class="email-from"><b>From:</b>'+SOC_escapehtml(emailheaders.from)+'</div>'+
        '<div class="email-to"><b>To:</b>'+SOC_escapehtml(emailheaders.to)+'</div>'+
        '<div class="email-cc"><b>Cc:</b>'+SOC_escapehtml(emailheaders.cc)+'</div>'+
        '<div class="email-labels"><b>Labels:</b>'+labels_str+'</div>';
        '<div class="email-date"><b>Date:</b>'+SOC_escapehtml(emailheaders.date)+'</div>'+
        '<div class="email-snippet">'+SOC_escapehtml(response_fromprovider.result.snippet)+'</div>';
    divforemail.innerHTML = generatedhtml;
}

function SOC_inbox_emaildetails_error_cb(response_fromprovider){
    SOC_updateprogress('error', 'Error getting details for message:' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
}

/**
 * called when labels are loaded from google
 * labels are cached locally
 * @param {object} response the response from google api
 * @returns {void}
 */
function SOC_inbox_loadlabels_cb(response){
    SOC_updateprogress('info','Finished loading labels');
    if(response && response.result){
        for(let tmplabel of response.result.labels){
            socglobal_providerclient.labels_cache[tmplabel.id] = tmplabel.name;
        }
    }
}
/**
 * 
 * @param {type} error
 * @returns {undefined}
 */
function SOC_inbox_loadlabels_error_cb(error){
    SOC_log(1, 'SOC_inbox_loadlabels_error_cb', 'Error loading labels;' + JSON.stringify(error));
    SOC_updateprogress('error','Error loading labels');
}

/**
 * called when the fiter form is submitted
 * @returns {Boolean} always returns false
 */
function SOC_inbox_filterform_submit(){
    SOC_inbox_listemails();
    return false;
}
/**
 * 
 * @returns {void}
 */
function SOC_inbox_listemails(){
    SOC_updateprogress('info','Loading emails');
    //listEmails(isonlyunread, filter_str, page_id, finished_callback, error_callback){
    SOC_inbox_loadlabels();
    let filter_str = SOC_gebi('inboxfilterinput').value;
    socglobal_providerclient.listEmails(filter_str, '', SOC_inbox_listemails_cb, SOC_inbox_listemails_error_cb);
}

function SOC_inbox_listemails_cb(response_fromprovider){
    let targetdiv = SOC_gebi('inboxmessagelistdiv');    
    let htmlstr = '';
    if(response_fromprovider.result.messages){
        for(let tmpmessage of response_fromprovider.result.messages){
            htmlstr+='<div class="inbox-mail" id="email_'+SOC_escapehtml(tmpmessage.id)+
                        '" onclick="SOC_reademail(\''+SOC_escapehtml(tmpmessage.id)+'\')">Loading message '+
                        SOC_escapehtml(tmpmessage.id)+'</div>';
            socglobal_providerclient.getEmailInfo(tmpmessage.id, SOC_inbox_emaildetails_cb, SOC_inbox_emaildetails_error_cb);
        }
    }
    targetdiv.innerHTML = htmlstr;
    socglobal_inboxrefreshed = true;
}

function SOC_inbox_listemails_error_cb(response_fromprovider){
    SOC_updateprogress('error', 'Error loading emails. ' + SOC_escapehtml(JSON.stringify(response_fromprovider)));
    SOC_alert('Error loading emails');    
}

/**
 * returns a map of only the headers we are interested in from response_fromprovider.result.payload.headers
 * @param {object} response_fromprovider.result.payload.headers
 * @returns {object} payload_headers headername:headervalue
 */
function SOC_inbox_parseemailheaders(response_fromprovider){
    let rv = {to:'', cc:'', subject:'', date:'', from:''};
    for(let tmpheaderobj of response_fromprovider.result.payload.headers){
        switch(tmpheaderobj.name){
            case 'To':
                rv.to = tmpheaderobj.value;
                break;
            case 'Cc':
                rv.cc = tmpheaderobj.value;
                break;
            case 'Subject':
                rv.subject = tmpheaderobj.value;
                break;
            case 'Date':
                rv.date = tmpheaderobj.value;
                break;
            case 'From':
                rv.from = tmpheaderobj.value;
                break;
        }
    }
    return rv;
}
/**
 * 
 * @returns {undefined}
 */
function SOC_inbox_loadlabels(){
    SOC_updateprogress('info','Loading labels');
    if(socglobal_providerclient.labels_cache_loaded){
        return; //we already have them, no need to load them every single time?
    }
    socglobal_providerclient.listLabels(SOC_inbox_loadlabels_cb, SOC_inbox_loadlabels_error_cb);
}

