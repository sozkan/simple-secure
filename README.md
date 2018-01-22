# simple-secure
End-to-end encryption for Gmail and Google Drive(for now)

## Quick Summary : 

- Pure client side javascript. No installations. The only requirement is a modern browser (only latest versions of Chrome or Firefox)
- Uses only the webcrypto API for cryptographic operations
- It uses proper **Public key cryptography**. No more texting encryption passwords. Just add your contact's public key once and send secure emails without hassle. Secure messages will also be digitally signed to assure integrity of messages.
- No certificates, no certificate authorities, no fees. You will be your own authority.
- Easy key management. Keys will be automatically stored in Google drive. You will not need to manually copy your keys from one system to another.
- No dependencies except the Google javascript API, no hidden dependencies, no npm, no minified code
- Uses only the official Google API to access your Google/Gmail accounts

### Gmail Security : 
- Real end-to-end encryption: When sending an email, encrypted contents will be created in your browser, and when reading emails, encrypted contents will be decrypted in your browser. Even Google won't have access to encrypted contents. Please note that this does not mean that email headers or the email subject are encrypted. Encrypted contents will be attached to a regular email message as a file.

### Google Drive Security :
- Proper asymmetric encryption and signatures for your secret files. 
- Edit text files using this app and save to Google Drive in encrypted and signed format
- Or upload binary files to Google Drive in encrypted and signed format
- Your keys and files will be available on all devices seamlessly (as long as you can access Google Drive)
- All files will be encrypted/decrypted in your browser. Even Google will not have access to their contents

## Live demo : 
https://simple-secure.com

For maximum security download and deploy the application on your own https server. Deploying your own instance is quite easy. See documentation.html for more information.
YOU ARE STRONGLY ENCOURAGED TO HOST YOUR OWN COPY OF THE APPLICATION. THE DEMO SITE IS JUST A DEMO.

## Known issues : 
- Max raw email size allowed by Google is 30MBs but trying to attach or read attached large files may kill your browser or may be very slow. Try to keep max email size around 5MBs. 
- Size concerns apply to Google Drive files as well, the larger the slower. 

## TODO/Roadmap: 
- I will develop a desktop app which will use the same keys for encrypting/decrypting and/or signing/verifying larger files

