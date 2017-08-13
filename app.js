/* jshint node: true, devel: true */
'use strict';

const
    bodyParser = require('body-parser'),
    config = require('config'),
    crypto = require('crypto'),
    express = require('express'),
    https = require('https'),
    request = require('request'),
    http = require('http'),
    routes = require('./routes/index'),
    app = express(),
    multer = require('multer'),
    path = require('path'),
    moment = require('moment-timezone');


//Bodyparser middleware
app.use(bodyParser.urlencoded({ extended: false}));
//{ verify: verifyRequestSignature } deleted from function because it throws errors if JSON.parse function is called


//Throws errors if callbacks are not from facebook
//{ verify: verifyRequestSignature } deleted from function because it throws errors if JSON.parse function is called
app.use(bodyParser.json());

// para CORN
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//Setting port
app.set('port', process.env.PORT || 8000);

//Setting view engine
app.set('view engine', 'ejs');

//Set Public folder as static folder
app.use(express.static('public'));

// le dice a express que el directorio 'uploads', es estatico.
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));

//Use ./routes/index.js as routes root /
app.use('/', routes);

//Global variables
var i = 0;
//data when user clicks send to messenger button -> send to index.js REST-API
var a = {};
//object a stringified in order to make post request to REST-API
var b = "";
// c = messageData.recipient.id; called in updateDb function -> if sendAPI call failes
var c = "";
//Store uploaded files - destination set / name of file set
var storage = multer.diskStorage({
    // Destination of upload
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    // Rename of file
    filename: function (req, file, cb) {
        cb(null, Math.random() + "*" + file.originalname.replace(/ /g, ""));
    }
});
//Store uploaded files - destination set / name of file set
var upload = multer({ storage: storage });

/*
 * Be sure to setup your config values before running this code. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */

// Data set p in config/default.json file
// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
    process.env.MESSENGER_APP_SECRET :
    config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
    (process.env.MESSENGER_VALIDATION_TOKEN) :
    config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
    (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
    config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
    (process.env.SERVER_URL) :
    config.get('serverURL');

// HOST_URL used for DB calls - SERVER_URL without https or https://
const HOST_URL = config.get('hostURL');
//Used in receivedAuthentication function
const HOTEL_NAME = config.get('hotelName');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
    console.error("Missing config values");
    process.exit(1);
}

//source: https://gist.github.com/aitoribanez/8b2d38601f6916139f5754aae5bcc15f
//New file got attached to message
app.post("/upload", upload.array("uploads[]", 12), function (req, res) {
    console.log("console log in app.post upload", 'files', req.files);
    exports.uploadedFileName = req.files[0].filename;
    routes.newFileUploaded();
    res.send(req.files);
});

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function(messagingEvent) {
                if (messagingEvent.optin) {
                    receivedAuthentication(messagingEvent);
                } else if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else if (messagingEvent.delivery) {
                    receivedDeliveryConfirmation(messagingEvent);
                } else if (messagingEvent.postback) {
                    receivedPostback(messagingEvent);
                } else if (messagingEvent.read) {
                    receivedMessageRead(messagingEvent);
                } else if (messagingEvent.account_linking) {
                    receivedAccountLink(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL.
 *
 */
app.get('/authorize', function(req, res) {
    var accountLinkingToken = req.query.account_linking_token;
    var redirectURI = req.query.redirect_uri;

    // Authorization Code should be generated per user by the developer. This will
    // be passed to the Account Linking callback.
    var authCode = "1234567890";

    // Redirect users to this URI on successful login
    var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

    res.render('authorize', {
        accountLinkingToken: accountLinkingToken,
        redirectURI: redirectURI,
        redirectURISuccess: redirectURISuccess
    });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];
    console.log("Req headers:");
    console.log(req.headers);
    console.log("Signature:" + signature);
    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature. Line 358 app.js // Callback from Facebook. If Server URL is not the same as webhook URL on facebook");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', APP_SECRET)
            .update(buf)
            .digest('hex');

        if (signatureHash != expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
//Recieve authentication from wlanlandingpage when user click Send to messenger button - Send data to mongoDB database.
function receivedAuthentication(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfAuth = event.timestamp;

    // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
    // The developer can set this to an arbitrary value to associate the
    // authentication callback with the 'Send to Messenger' click event. This is
    // a way to do account linking when the user clicks the 'Send to Messenger'
    // plugin.
    var passThroughParam = event.optin.ref;

    console.log("Received authentication for user %d and page %d with pass " +
        "through param '%s' at %d", senderID, recipientID, passThroughParam,
        timeOfAuth);

    //https://stackoverflow.com/questions/5643321/how-to-make-remote-rest-call-inside-node-js-any-curl
    var buffer = "";
    var optionsget = {
        host: 'graph.facebook.com',
        port: 443,
        path: '/v2.6/' + senderID +
        '?fields=first_name,last_name,profile_pic,is_payment_enabled,locale,timezone,gender&access_token=' +
        PAGE_ACCESS_TOKEN,
        method: 'GET'
    };

    console.info('Options prepared:');
    console.info(optionsget);
    console.info('Do the GET call');

    // do the GET request to retrieve data from the user's graph API
    var reqGet = https.request(optionsget, function (res) {
        console.log("statusCode: ", res.statusCode);
        // uncomment it for header details
        // console.log("headers: ", res.headers);

        res.on('data', function (d) {
            console.info('GET result:\n');
            process.stdout.write(d);
            buffer += d;
            // console.log(buffer);
            //parse buffer to JSON object
            a = JSON.parse(buffer);
            // console.log("Data recieving from Send to messenger button" + a);
            // When an authentication is received, we'll send a message back to the sender
            // to let them know it was successful.
            sendTextMessage(senderID, "Hallo " +  a.first_name + " " + a.last_name + "! Sie haben sich erfolgreich angemeldet. " +
                "Sie erhalten nun Neuigkeiten via Facebook Messenger " +
                "von Ihrem " + HOTEL_NAME +  " Team. Viel Spaß!");
            //Additionally senderID is added to the Javascript object, which is saved to the MongoDB
            a["senderId"] = senderID;
            //User is a "angemeldeter Gast" and is able to recieve messages
            a["signed_up"] = true;
            var time = moment().tz('Europe/Vienna').format();
            var time2 = time.replace(/T/gi, " | ");
            var time3 = time2.slice(0, -6);
            a["signed_up_at"] = time3;
            //Parse JSON object to JSON string
            b = JSON.stringify(a);
        });
    });
    // Build the post string from an object
    reqGet.end();
    reqGet.on('error', function (e) {
        console.error(e);

    });
    setTimeout(postNewUserToDB, 15000);
}

//New User is saved in DB, function called in receivedAuthentication - send to index.js /guests REST-FUL API
function postNewUserToDB() {
    // An object of options to indicate where to post to
    var post_options = {
        //Change URL to hotelmessengertagbag.herokuapp.com if deploying
        host: HOST_URL,
        port: '80',
        path: '/guests',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Set up the request
    var post_req = http.request(post_options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });

    // post the data
    post_req.write(b);
    post_req.end();
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
//------>Main function where most answer functions are called from<------
function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;
    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));
    var isEcho = message.is_echo;
    var messageId = message.mid;
    var appId = message.app_id;
    var metadata = message.metadata;

    //You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;
    var quickReply = message.quick_reply;

    if (isEcho) {
        //Just logging message echoes to console
        console.log("Received echo for message %s and app %d with metadata %s",
            messageId, appId, metadata);
        return;

    } else if (quickReply) {
        var quickReplyPayload = quickReply.payload;
        console.log("Quick reply for message %s with payload %s",
            messageId, quickReplyPayload);

        if (messageText) {
            // If we receive a text message, check to see if it matches any special
            // keywords and send back the corresponding example. Otherwise, just echo
            // the text we received.

            switch (messageText) {

                case 'typing on':
                    sendTypingOn(senderID);
                    break;

                case 'typing off':
                    sendTypingOff(senderID);
                    break;

                case 'account linking':
                    sendAccountLinking(senderID);
                    break;
            }
        }
    }
}

//2 functions for broadcasting texts - Broadcast gesendet von Dashboard to all angemeldete Gäste
exports.sendBroadcast = function (recipientId, broadcastText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: broadcastText,
            metadata: "DEVELOPER_DEFINED_METADATA",
        }
    };
    callSendAPI(messageData);
};

//Broadcast gesendet von Dashboard to all angemeldete Gäste - Wenn Anhang hochgeladen, diese function wird gecalled
exports.sendBroadcastFile = function (recipientId, URLUploadedFile) {
    console.log(URLUploadedFile);
    var messageData;
    var imageEnding = "jpg";
    var imageEnding2 = "png";

    if (URLUploadedFile.indexOf(imageEnding) !== -1 || URLUploadedFile.indexOf(imageEnding2) !== -1 ) {
        messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "image",
                    payload: {
                        url: URLUploadedFile
                    }
                }
            }
        };
        callSendAPI(messageData);
    } else {
        messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "file",
                    payload: {
                        url: URLUploadedFile
                    }
                }
            }
        };
        callSendAPI(messageData);
    }
};

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var delivery = event.delivery;
    var messageIDs = delivery.mids;
    var watermark = delivery.watermark;
    var sequenceNumber = delivery.seq;

    if (messageIDs) {
        messageIDs.forEach(function(messageID) {
            console.log("Received delivery confirmation for message ID: %s",
                messageID);
        });
    }

    console.log("All message before %d were delivered.", watermark);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 *
 */
function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;
    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    var payload = event.postback.payload;
    //console.log(messageData.message.attachment.payload.elements[0].title);
    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);

    // When a postback is called, we'll send a message back to the sender to
    // let them know it was successful
    if (payload === "1") {
        sendGifMessage(senderID);
    }
    else if (payload === "GET_STARTED_PAYLOAD") {
        sendWelcomeMessage(senderID);
    }
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 *
 */
function receivedMessageRead(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    // All messages before watermark (a timestamp) or sequence have been seen.
    var watermark = event.read.watermark;
    var sequenceNumber = event.read.seq;

    console.log("Received message read event for watermark %d and sequence " +
        "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 *
 */
function receivedAccountLink(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    var status = event.account_linking.status;
    var authCode = event.account_linking.authorization_code;

    console.log("Received account link event with for user %d with status %s " +
        "and auth code %s ", senderID, status, authCode);
}

/*
 * Send a text message using the Send API.
 *
 */
//sendMessage example -> used and called in receivedAuthentication function
function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };

    callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
    console.log("Turning typing indicator on");

    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_on"
    };

    callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
    console.log("Turning typing indicator off");

    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_off"
    };

    callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Welcome. Link your account.",
                    buttons:[{
                        type: "account_link",
                        url: SERVER_URL + "/authorize"
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 * If Failed calling Send API a put request is made to the the REST-FUL API in index.js
 */
function callSendAPI(messageData) {
    console.log("SEND API CALLLED <------------");
    console.log("Recipient ID: top " + messageData.recipient.id);
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            console.log("Recipient ID:" + recipientId);
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
                //senderIDTransfer.splice((0), senderIDTransfer.length);
                //senderIDTransfer.push(recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
            //If error is because attached file can not be found, DB is not getting updated
            var errorMsgNoDBUpdate = "Failed to fetch the file from the url";
            var errorMsgNoDBUpdate2 = "Message cannot be empty, must provide valid attachment or text";
            //if error message if that it Failed to fetch the file from the url, function is returned
            if(body.error.message.indexOf(errorMsgNoDBUpdate) !== -1 || body.error.message.indexOf(errorMsgNoDBUpdate2) !== -1){
                return;
            }
            console.log(messageData.recipient.id);
            // var c is assigned to the current recipient id
            c = messageData.recipient.id;
            //updateDB  is called with current recipient id value -> c which is a global variable
            if(recipientId) {
                updateDB();
            }
            //var index = senderIDTransfer.indexOf(messageData.recipient.id);
            //console.log(index);
            //senderIDTransfer.splice(index, 1);
            //console.log(senderIDTransfer);
            //Problem with c = is changed everytime the function Call send api is called - when updateDB function is called the value is the same as the call send api is called the last time
        }
    });
}

/*
 * Send update to REST-ful API in index.js if signed-out, change signed-up field to false
 */
function updateDB(){
    console.log("updateDB function called" + c);

    // An object of options to indicate where to post to
    var put_options = {
        //Change URL on top if deploying
        host: HOST_URL,
        port: '80',
        path: '/guests',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    // Set up the request
    var put_req = http.request(put_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: of successful put request - line 2540 + chunk var (deleted) //app.js 840 ');
        });
    });

    // post the data
    put_req.write(c);
    put_req.end();
}

/*
 * Start server
 * Webhooks must be available via SSL with a certificate signed by a valid
 * certificate authority.
 */
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});

module.exports = app;