const
    express = require('express'),
    router = express.Router(),
    https = require('https'),
    request = require('request'),
    http = require('http'),
    sourceFile = require('../app'),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    mongojs = require('mongojs'),
    db = mongojs('mongodb://anton:b2d4f6h8@ds127132.mlab.com:27132/servicio', ['mamaThreslMessages', 'mamaThreslGaeste', 'mamaThreslScheduledMessages']),
    config = require('config'),
    CronJob = require('cron').CronJob,
    moment = require('moment-timezone');

// HOST_URL used for DB calls - SERVER_URL without https or https://
const HOST_URL = config.get('hostURL');
// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = config.get('serverURL');

//Bodyparser middleware
router.use(bodyParser.urlencoded({ extended: false}));

//Cors middleware
router.use(cors());

//Global variables
var errMsg = "";
//New file uploaded is initially set to false
var newFileUploaded = false;
//Temp array of gaeste sender ids for sending message
var gaesteGlobalSenderID =[];
//Variables for cornjob
var dateNowFormatted = "";
var dateReqFormatted = "";
var dateDay = "";
var dateMonth = "";
var dateHour = "";
var dateMinute = "";
var broadcast = "";

//----->REST-FUL API<------//

//Get all messages
router.get('/guestsMessages', function(req, res, next) {
    console.log("guestsMessages get called");
    //Get guests from Mongo DB
    db.mamaThreslMessages.find(function(err, message){
        if (err){
            res.send(err);
        }
        res.json(message);
    });
});

//Get all ScheduldedMessages
router.get('/guestsScheduledMessages', function(req, res, next) {
    console.log("guestsMessages get called");
    //Get guests from Mongo DB
    db.mamaThreslScheduledMessages.find(function(err, message){
        if (err){
            res.send(err);
        }
        res.json(message);
    });
});

//Get all guests
router.get('/guests', function(req, res, next) {
    console.log("guests get called");
    //Get guests from Mongo DB
    db.mamaThreslGaeste.find(function(err, gaeste){
        if (err){
            res.send(err);
        }
        res.json(gaeste);
    });
});

//Save new guests
router.post('/guests', function(req, res, next) {
    //JSON string is parsed to a JSON object
    console.log("Post request made to /guests");
    var guest = req.body;
    console.dir(guest);
    if(!guest.first_name || !guest.last_name){
        res.status(400);
        res.json({
            error: "Bad data"
        });
    } else {
        db.mamaThreslGaeste.save(guest, function (err, guest) {
            if (err) {
                res.send(err);
            }
            res.json(guest);
        });
    }
});

//Update guest
router.put('/guests', function(req, res, next) {
    console.log("Put request made to /guest");
    var guestUpdate = req.body;
    var guestUpdateString = JSON.stringify(guestUpdate);
    var guestUpdateHoi = guestUpdateString.slice(2, -5);
    console.log("SenderId:" + guestUpdateHoi);
    db.mamaThreslGaeste.update({
            senderId:  guestUpdateHoi  },
        {
            $set: { signed_up: false }
        }, { multi: true }, function (err, gaeste){
            if(err) {
                console.log("error: " + err);
            } else {
                console.log("Updated successfully, gaeste var (deleted) - put request signed_up: false successful. //index.js 128");
            }});
});

router.newFileUploaded = function () {
    newFileUploaded = true;
    console.log("####### 1 newFileUploaded is " + newFileUploaded);
};

//Post message to guests
router.post('/guestsMessage', function(req, res, next) {
    console.log("#####----### 2 Post request made to /guestsMessage");
    //message extracted
    var message = req.body;
    var senf = JSON.stringify(message);
    console.log("Message Test:" );
    console.log(senf);
    //Date from now
    var dateNow = new Date();
    var dateString = JSON.stringify(dateNow);
    dateNowFormatted = dateString.slice(1, 17);
    //Date from message request
    dateReqFormatted = req.body.date.slice(0, 16);
    dateDay = req.body.date.slice(8, 10);
    dateMonth = req.body.date.slice(3, 7);
    dateHour = req.body.date.slice(15, 18);
    dateMinute = req.body.date.slice(19, 21);
    broadcast = req.body.text;
    //Get uploaded file name from upload post function line app.js 114
    var uploadedFileName = sourceFile.uploadedFileName;
    var updateMessageObjectUploadedFile = { uploaded_file: uploadedFileName };
    console.log("updateMessageObjectUploadedFile:" + JSON.stringify(updateMessageObjectUploadedFile));
    //Destination URL for uploaded files
    var URLUploadedFile = String(config.get('serverURL') + "/uploads/" + uploadedFileName);
    //Find all senderids from signed_up guests abd push it to the temporary array gaesteGlobalSenderID
    db.mamaThreslGaeste.find(function (err, gaeste) {
        if (err) {
            errMsg = "Das senden der Nachricht ist nicht möglich. Es sind keine Gäste angemeldet.";
        } else {
            gaesteGlobalSenderID = [];
            for(var l = 0; l < gaeste.length; l++){
                if (gaeste[l].signed_up) {
                    gaesteGlobalSenderID.push(gaeste[l].senderId);
                }
            }
            setTimeout(function () {
                console.log(dateReqFormatted + "=" + dateNowFormatted);
                //If message is send at least 1 min later than now, schedule event is fired
                if (dateReqFormatted !== dateNowFormatted) {
                    console.log("scheduled event fired!");
                    //Save scheduled Message to db

                    if (uploadedFileName !== undefined && newFileUploaded === true && uploadedFileName !== "undefined") {
                        var scheduledMessageUpdated = Object.assign(message, updateMessageObjectUploadedFile);
                        console.log("scheduleMessage updated: " + scheduledMessageUpdated.text + " " + scheduledMessageUpdated.date +  " " + scheduledMessageUpdated.uploaded_file);

                        setTimeout(function() {
                            db.mamaThreslScheduledMessages.save(scheduledMessageUpdated, function (err, scheduledMessageUpdated) {
                                console.log("scheduleMessageUpdated saved: " + scheduledMessageUpdated.text + " " + scheduledMessageUpdated.date +  " " + scheduledMessageUpdated.uploaded_file);
                                if (err) {
                                    res.send(err);
                                }
                                res.json(scheduledMessageUpdated);
                            });
                        }, 3000);
                    } else {
                        setTimeout(function() {
                            db.mamaThreslScheduledMessages.save(message, function (err, message) {
                                console.log("scheduleMessage saved: " + message.text + " " + message.date);
                                if (err) {
                                    res.send(err);
                                }
                                res.json(message);
                            });
                        }, 3000);
                    }

                    //If there is a file uploaded, update message in db
                    console.log("######Uploadedfilename line 170");
                    console.log(uploadedFileName);
                    console.log("######newFileUploaded line 172");
                    console.log(newFileUploaded);
                    //https://github.com/kelektiv/node-cron
                    //Cronjob is created
                    var job = new CronJob({
                        //Global variables from the message sent are set as the crontime property
                        cronTime: "00 " + dateMinute + " " + dateHour + " " + dateDay + " " + dateMonth + " *",
                        onTick: function () {
                            console.log("00 " + dateMinute + " " + dateHour + " " + dateDay + " " + dateMonth + " *");
                            console.log('job ticked');
                            console.log(gaesteGlobalSenderID + " " + broadcast);
                            console.log("guestsMessages get called");

                            //https://stackoverflow.com/questions/5643321/how-to-make-remote-rest-call-inside-node-js-any-curl
                            //Get scheduled messages from db
                            var buffer = "";
                            var optionsget = {
                                host: HOST_URL,
                                path: '/guestsScheduledMessages',
                                method: 'GET'
                            };
                            console.info('Options prepared:');
                            console.info(optionsget);
                            console.info('Do the GET call');

                            //Do the GET request to retrieve scheduled messages from the db
                            var reqGet = https.request(optionsget, function (res) {
                                console.log("statusCode: ", res.statusCode);
                                // uncomment it for header details
                                // console.log("headers: ", res.headers);

                                res.on('data', function (d) {
                                    console.info('GET result:\n');
                                    buffer += d;
                                    //scheduled message is stored in bufferObject
                                    var bufferObject = JSON.parse(buffer);
                                    //data is retrieved from job.cronTime property
                                    var crontTimeString = job.cronTime.toString();
                                    var cronTimeSplitted = crontTimeString.split(" ");
                                    for(var w = 0; w < cronTimeSplitted.length; w++) {
                                        console.log(cronTimeSplitted[w]);
                                    }

                                    var minutes = cronTimeSplitted[1];
                                    if (minutes.length === 1) {
                                        minutes = "0" + minutes;
                                    }
                                    var hour = cronTimeSplitted[2];
                                    if (hour.length === 1) {
                                        hour = "0" + hour;
                                    }
                                    var day = cronTimeSplitted[3];
                                    if (day.length === 1) {
                                        day = "0" + day;
                                    }
                                    var monthNumber = cronTimeSplitted[4];

                                    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                                    var month = monthNames[monthNumber];

                                    //Regex is the added variables from the cronbJob job.crontime property
                                    var regex = String(month + " " + day + " 2017 " + hour + ":" + minutes);
                                    console.log("---->regex:"+regex);
                                    //Messages from stored scheduled messages stored in rightmessage variable
                                    for (var m = 0; m < bufferObject.length; m++) {
                                        var rightMessage = bufferObject[m];
                                        //If the rightmessage date property is the same as from the cron job property stored in the regex variable
                                        if (rightMessage.date.indexOf(regex) !== -1) {
                                            console.log("HHHH:" + rightMessage.date + rightMessage.text);
                                            //Send out to all signed up people the the text property of the right scheduled message
                                            for (var l = 0; l < gaesteGlobalSenderID.length; l++) {
                                                sourceFile.sendBroadcast(gaesteGlobalSenderID[l], rightMessage.text);
                                                //And if there exists a uploaded_file property, send out to all signed up people the the text property of the right scheduled message
                                                if (rightMessage.uploaded_file) {
                                                    console.log("URLUploadedFile:" + URLUploadedFile);
                                                    console.log("rightMessage.uploadedfile: " + rightMessage.uploaded_file);
                                                    sourceFile.sendBroadcastFile(gaesteGlobalSenderID[l], SERVER_URL + "/uploads/" + rightMessage.uploaded_file);
                                                }
                                            }
                                            //Now the message object in the db is update that it is in the past - now it is displayed in white in the user interface
                                            db.mamaThreslScheduledMessages.update({
                                                    text: rightMessage.text
                                                },
                                                {
                                                    $set: {isInThePast: true}
                                                }, {multi: true}, function (err, messageUpdated) {
                                                    if (err) {
                                                        console.log("error: " + err);
                                                    } else {
                                                        console.log("Updated successfully, scheduled messages isInThePast var (deleted)");
                                                    }
                                                });
                                        }
                                    }
                                });
                            });
                            // Build the post string from an object
                            reqGet.end();
                            reqGet.on('error', function (e) {
                                console.error("Error line 450:" + e);
                            });
                        },
                        start: false,
                        timeZone: 'Europe/Berlin'
                    });
                    console.log("job variable: " + String(job.cronTime));
                    //Start the job
                    job.start();
                    console.log("job variable: " + String(job.cronTime));
                } else {
                    for (var j = 0; j < gaesteGlobalSenderID.length; j++) {
                        console.log("gaesteGlobalSenderID: line 166 - " + gaesteGlobalSenderID[j]);
                        sourceFile.sendBroadcast(gaesteGlobalSenderID[j], broadcast);
                    }

                    if (uploadedFileName !== undefined && newFileUploaded === true && uploadedFileName !== "undefined") {
                        var messageUpdated = Object.assign(message, updateMessageObjectUploadedFile);
                        console.log("Message updated: " + messageUpdated.text + " " + messageUpdated.date + " " + messageUpdated.uploaded_file);

                        setTimeout(function () {
                            db.mamaThreslMessages.save(messageUpdated, function (err, messageUpdated) {
                                console.log("MessageUpdated saved: " + messageUpdated.text + " " + messageUpdated.date + " " + messageUpdated.uploaded_file);
                                if (err) {
                                    res.send(err);
                                }
                                res.json(messageUpdated);
                            });
                        }, 3000);

                    } if (newFileUploaded === false) {
                        setTimeout(function () {
                            db.mamaThreslMessages.save(message, function (err, message) {
                                console.log("Message saved: " + message.text + " " + message.date);
                                if (err) {
                                    res.send(err);
                                }
                                res.json(message);
                            });
                        }, 3000);
                    }
                    setTimeout(function() {

                        var bufferMessages = "";
                        var optionsget = {
                            host: HOST_URL,
                            path: '/guestsMessages',
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
                                //process.stdout.write(d);
                                bufferMessages += d;
                                //for (var q = 0; q < bufferMessages.length; q++) {
                                var objectMessages = JSON.parse(bufferMessages);
                                var lastMessage = objectMessages.length - 1;
                                console.log("1:" + lastMessage);
                                console.log("2:" + objectMessages[lastMessage].text);
                                console.log("3:" + objectMessages[lastMessage].uploaded_file);
                                if (objectMessages[lastMessage].uploaded_file) {
                                    console.log("###### 5" + objectMessages[lastMessage].uploaded_file);
                                    for (var k = 0; k < gaesteGlobalSenderID.length; k++) {
                                        console.log(config.get('serverURL') + "/uploads/" + objectMessages[lastMessage].uploaded_file);
                                        sourceFile.sendBroadcastFile(gaesteGlobalSenderID[k], String(config.get('serverURL') + "/uploads/" + objectMessages[lastMessage].uploaded_file));
                                    }
                                }
                                //}
                            });
                        });
                        // Build the post string from an object
                        reqGet.end();
                        reqGet.on('error', function (e) {
                            console.error("Error line 450:" + e);
                        });
                    }, 5000);
                }
                errMsg = "";

            }, 1000);
        }
    });
    setTimeout(function() {
        newFileUploaded = false;
    }, 2000);
});

//Get W-Lan-landingpage
router.get('/wlanlandingpage', function(req, res, next) {
    res.render('wlanlandingpage', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    console.log("wlanlandingpage ejs rendered");

});

module.exports = router;