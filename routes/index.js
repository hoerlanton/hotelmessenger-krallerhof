var express = require('express');
var router = express.Router();
var https = require('https');
var request = require('request');
var http = require('http');
var parseString = require('xml2js').parseString;
var sourceFile = require('../app');
var cors = require('cors');
var bodyParser = require('body-parser');
var mongojs = require('mongojs');
var db = mongojs('mongodb://anton:b2d4f6h8@ds127132.mlab.com:27132/servicio', ['krallerhofMessages', 'krallerhofGaeste', 'krallerhofScheduledMessages']);
var config = require('config');
var cron = require('node-cron');
var CronJob = require('cron').CronJob;

// HOST_URL used for DB calls - SERVER_URL without https or https://
const HOST_URL = config.get('hostURL');
// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
    (process.env.SERVER_URL) :
    config.get('serverURL');

//Bodyparser middleware
router.use(bodyParser.urlencoded({ extended: false}));

//Cors middleware
router.use(cors());

//Global variables
var errMsg = "";
var successMsg = "";

//Data recieved from the HotelResRQ request to Channelmanager
var newFileUploaded = false;
var gaesteGlobalSenderID =[];
var broadcast = "";
var dateNowFormatted = "";
var dateReqFormatted = "";
var dateDay = "";
var dateMonth = "";
var dateHour = "";
var dateMinute = "";

//----->REST-FUL API<------//

//Get all messages
router.get('/guestsMessages', function(req, res, next) {
    console.log("guestsMessages get called");
    //Get guests from Mongo DB
    db.krallerhofMessages.find(function(err, message){
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
    db.krallerhofScheduledMessages.find(function(err, message){
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
    db.krallerhofGaeste.find(function(err, gaeste){
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
        db.krallerhofGaeste.save(guest, function (err, guest) {
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
    db.krallerhofGaeste.update({
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

//Post message to guests
router.post('/guestsMessage', function(req, res, next) {
    console.log("Post request made to /guestsMessage");

    var message = req.body;
    var dateNow = new Date();
    var dateString = JSON.stringify(dateNow);
    dateNowFormatted = dateString.slice(1, 17);
    dateReqFormatted = req.body.date.slice(0, 16);
    dateDay = req.body.date.slice(8, 10);
    dateMonth = req.body.date.slice(3, 7);
    dateHour = req.body.date.slice(15, 18);
    dateMinute = req.body.date.slice(19, 21);
    broadcast = req.body.text;
    var uploadedFileName = sourceFile.uploadedFileName;
    //Destination URL for uploaded files
    var URLUploadedFile = String(config.get('serverURL') + "/uploads/" + uploadedFileName);
    newFileUploaded = sourceFile.newFileUploaded;

    db.krallerhofGaeste.find(function (err, gaeste) {
        if (err) {
            errMsg = "Das senden der Nachricht ist nicht möglich. Es sind keine Gäste angemeldet.";
        } else {
            gaesteGlobalSenderID = [];
            for(var l = 0; l < gaeste.length; l++){
                if (gaeste[l].signed_up) {
                    gaesteGlobalSenderID.push(gaeste[l].senderId);
                }
            }
            broadcastMessages();
        }
    });

    function broadcastMessages() {
        console.log(dateReqFormatted + "=" + dateNowFormatted);
        //If message is not send at least 1 min later than now, schedule event is not fired
        if (dateReqFormatted !== dateNowFormatted) {
            console.log("scheduled event fired!");
            //Save Message to DB
            db.krallerhofScheduledMessages.save(message, function (err, message) {
                console.log("scheduleMessage saved: " + message.text + " " + message.date);
                if (err) {
                    res.send(err);
                }
                res.json(message);
            });

            if (uploadedFileName !== undefined && newFileUploaded === true) {

                db.krallerhofScheduledMessages.update({
                        text: message.text
                    },
                    {
                        $set: {uploaded_file: uploadedFileName}
                    }, {multi: true}, function (err, message) {
                        if (err) {
                            console.log("error: " + err);
                        } else {
                            console.log("Updated successfully, scheduled messages var (deleted)");
                        }
                    });
            }
            var job = new CronJob({
                cronTime: "00 " + dateMinute + " " + dateHour + " " + dateDay + " " + dateMonth + " *",
                onTick: function () {
                    console.log("00 " + dateMinute + " " + dateHour + " " + dateDay + " " + dateMonth + " *");
                    console.log('job ticked');
                    console.log(gaesteGlobalSenderID + " " + broadcast);
                    console.log("guestsMessages get called");
                    //Get guests from Mongo DB

                    //https://stackoverflow.com/questions/5643321/how-to-make-remote-rest-call-inside-node-js-any-curl
                    var buffer = "";
                    var optionsget = {
                        host: HOST_URL,
                        path: '/guestsScheduledMessages',
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
                            buffer += d;
                            //console.log(buffer);
                            var bufferObject = JSON.parse(buffer);

                            //console.log(bufferObject);
                            console.log("jobcoirntime: " + job.cronTime.toString());
                            console.log("jobcoirntime: " + job.cronTime.toString().slice(2, 4));

                            var minutes = job.cronTime.toString().slice(2, 4);
                            if (minutes.length === 1) {
                                minutes = "0" + minutes
                            }
                            var hour = job.cronTime.toString().slice(5, 7);
                            if (hour.length === 1) {
                                hour = "0" + hour
                            }
                            var day = job.cronTime.toString().slice(8, 10);
                            if (day.length === 1) {
                                day = "0" + day
                            }
                            var monthNumber = job.cronTime.toString().slice(11, 12);

                            var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                            var month = monthNames[monthNumber];

                            //Filter the right message
                            var regex = String(month + " " + day + " 2017 " + hour + ":" + minutes);
                            console.log(regex);

                            for (var m = 0; m < bufferObject.length; m++) {
                                var rightMessage = bufferObject[m];
                                //console.log(rightMessage.date);
                                //console.log("rightmessage ohne date:" + rightMessage);
                                if (rightMessage.date.indexOf(regex) !== -1) {
                                    console.log("HHHH:" + rightMessage.date + rightMessage.text);
                                    for (var l = 0; l < gaesteGlobalSenderID.length; l++) {
                                        sendBroadcast(gaesteGlobalSenderID[l], rightMessage.text);
                                        if (rightMessage.uploaded_file) {
                                            console.log("URLUploadedFile:" + URLUploadedFile);
                                            console.log("rightMessage.uploadedfile: " + rightMessage.uploaded_file);
                                            sendBroadcastFile(gaesteGlobalSenderID[l], SERVER_URL + "/uploads/" + rightMessage.uploaded_file);
                                        }
                                    }
                                    db.krallerhofScheduledMessages.update({
                                            text: rightMessage.text
                                        },
                                        {
                                            $set: {isInThePast: true}
                                        }, {multi: true}, function (err, message) {
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
            job.start(); // job 1 started
        } else {
            //Save Message to DB
            db.krallerhofMessages.save(message, function (err, message) {
                console.log("Message saved: " + message.text + " " + message.date);
                if (err) {
                    res.send(err);
                }
                res.json(message);
            });

            if (uploadedFileName !== undefined && newFileUploaded === true) {

                db.krallerhofMessages.update({
                        text: message.text
                    },
                    {
                        $set: {uploaded_file: uploadedFileName}
                    }, {multi: true}, function (err, message) {
                        if (err) {
                            console.log("error: " + err);
                        } else {
                            console.log("Updated successfully uploaded_file element with " + uploadedFileName + ", messages var (deleted)");
                        }
                    });

                console.log("sendbroadcastfile runned");
                for (var k = 0; k < gaesteGlobalSenderID.length; k++) {
                    console.log("gaesteGlobalSenderID: line 166 - " + gaesteGlobalSenderID[k]);
                    console.log("------->>>>>: " + URLUploadedFile);
                    sendBroadcastFile(gaesteGlobalSenderID[k], URLUploadedFile);
                }
            }
            for (var j = 0; j < gaesteGlobalSenderID.length; j++) {
                console.log("gaesteGlobalSenderID: line 166 - " + gaesteGlobalSenderID[j]);
                sendBroadcast(gaesteGlobalSenderID[j], broadcast);
            }
        }
        errMsg = "";
        //set the boolean that a new file got uploaded to false
        newFileUploaded = false;
        sourceFile.newFileUploaded = false;
    }
});

//Get W-Lan-landingpage
router.get('/wlanlandingpage', function(req, res, next) {
    res.render('wlanlandingpage', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    console.log("wlanlandingpage ejs rendered");

});

//Get Google Analytics
router.get('/googleanalytics', function(req, res, next) {
    res.render('googleAnalytics');
    console.log("googleAnalytics ejs rendered");
});



//Get checkout form page
router.get('/checkout', function(req, res, next) {
    res.render('form', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
});

//Get checkout form page for room type Doppelzimmer Deluxe Holzleo
router.get('/DoppelzimmerDeluxeHolzleo', function(req, res, next) {
    res.render('form', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    if (req.route.path === "/DoppelzimmerDeluxeHolzleo") {
        sourceFile.ratePlanID = '<RoomRate NumberOfUnits=\"' + sourceFile.numberOfRooms + '\" RatePlanID=\"420590\" RatePlanType=\"11\" />';
        console.log("Works" + req.route.path);
    }
});

//Get checkout form page for room type Doppelzimmer Superior Steinleo
router.get('/DoppelzimmerSuperiorSteinleo', function(req, res, next) {
    res.render('formDoppelzimmerSuperiorSteinleo', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    if (req.route.path === "/DoppelzimmerSuperiorSteinleo") {
        sourceFile.ratePlanID = '<RoomRate NumberOfUnits=\"' + sourceFile.numberOfRooms + '\" RatePlanID=\"420592\" RatePlanType=\"11\" />';
        console.log("Works" + req.route.path);
    }
});

//Get checkout form page for room type Doppelzimmer Classic Steinleo
router.get('/DoppelzimmerClassicSteinleo', function(req, res, next) {
    res.render('formDoppelzimmerClassicSteinleo', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    if (req.route.path === "/DoppelzimmerClassicSteinleo") {
        sourceFile.ratePlanID = '<RoomRate NumberOfUnits=\"' + sourceFile.numberOfRooms + '\" RatePlanID=\"420594\" RatePlanType=\"11\" />';
        console.log("Works" + req.route.path);
    }
});

//Buchungsserfolg page
router.get('/bookingsuccess', function(req, res, next) {
    res.render('success', { title: 'Jetzt buchen', successMsg: successMsg, noMessage: !successMsg });
});

//Buchungsfehlschlag page
router.get('/bookingfailure', function(req, res, next) {
    res.render('error', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
});

//Facebook Login Test page
router.get('/facebookLogin', function(req, res, next) {
    res.render('facebookLogin', { title: 'Jetzt buchen', errMsg: errMsg, noError: !errMsg});
    console.log("facebookLogin ejs rendered");
});

//Recieve Checkout Form data, Make Reservation request and charge the Credit card via Stripe
router.post('/checkout', function(req, res, next){
    console.log("Checkout called <<<<------");

    //Setting up variables - aggregating data from the checkout form
    var checkoutData = JSON.stringify(req.body);
    var checkoutDataSplitted = checkoutData.split(",");
    var checkoutDataSplittedTwiceName = checkoutDataSplitted[0].split(":");
    var checkoutDataName = checkoutDataSplittedTwiceName[1].slice(1, -1);
    var checkoutDataSplittedTwiceAddress = checkoutDataSplitted[1].split(":");
    var checkoutDataAddress = checkoutDataSplittedTwiceAddress[1].slice(1, -1)
    var checkoutDataSplittedTwiceCardName = checkoutDataSplitted[2].split(":");
    var checkoutDataCardName = checkoutDataSplittedTwiceCardName[1].slice(1, -1);
    var checkoutDataSplittedTwiceCardNumber = checkoutDataSplitted[3].split(":");
    var checkoutDataCardNumber = checkoutDataSplittedTwiceCardNumber[1].slice(1, -1);
    var checkoutDataSplittedTwiceCardExpiryYear = checkoutDataSplitted[5].split(":");
    var checkoutDataCardExpiryYear = checkoutDataSplittedTwiceCardExpiryYear[1].slice(1, -1);
    var checkoutDataSplittedTwiceCardCvc = checkoutDataSplitted[6].split(":");
    var checkoutDataCardCvc = checkoutDataSplittedTwiceCardCvc[1].slice(1, -1);
    //var checkoutDataSplittedTwiceCardExpiryMonth = checkoutDataSplitted[4].split(":");
    //var checkoutDataCardExpiryMonth = checkoutDataSplittedTwiceCardExpiryMonth[1].slice(1, -1);

    //Exported on line 576
    var numberOfPersonsReservation = sourceFile.numberOfPersons - 1;

    if (numberOfPersonsReservation < 1) {
        numberOfPersonsReservation = 1
    }
    else if (numberOfPersonsReservation > 2) {
        numberOfPersonsReservation = 2
    }

    /*
     * Adding data from the app.js - exporting by exports.
     * Exported on line 584
     */
    var numberOfRoomsReservation = sourceFile.numberOfRooms;
    //Exported on line 597
    var arrivalDateReservation = sourceFile.arrivalDate;
    //Exported on line 670
    var departureDateReservation = sourceFile.departureDate;
    //Exported in function sendGenericMessageOfferX
    var ratePlanIDReservation = sourceFile.ratePlanID;

    //var senderID = sourceFile.senderID;
    //console.log("1:" + checkoutDataName + "2:" + checkoutDataAddress + "3:" + checkoutDataCardName + "4:" + checkoutDataCardNumber +"5:" + checkoutDataCardExpiryYear + "6:" + checkoutDataCardCvc + "7:" + numberOfPersonsReservation + "8:" + numberOfRoomsReservation + "9:" + arrivalDateReservation + "10:" + departureDateReservation + "11:" + ratePlanIDReservation);

    resetData();
    sendHotelResRQ(checkoutDataName, checkoutDataAddress, checkoutDataCardName, checkoutDataCardNumber, checkoutDataCardExpiryYear, checkoutDataCardCvc, numberOfPersonsReservation, numberOfRoomsReservation, arrivalDateReservation, departureDateReservation, ratePlanIDReservation);
    setTimeout(function () {
        if (redirect) {
            console.log("bookingfailure");
            return res.redirect('/bookingfailure');
        } else {
            assignTotalPriceReservation();
            var stripe = require("stripe")(
                "sk_test_lt0sXEAzs52AA4Nh3PBc3fec"
            );
            stripe.charges.create({
                amount: totalPriceChargeReservationInt * 100,
                currency: "eur",
                source: req.body.stripeToken, // obtained with Stripe.js
                description: "Test charge"
            }, function (err, charge) {
                if (err) {
                    errMsg = "Error";
                    console.log("Charge failed!");
                    return res.redirect('/checkout');
                }
                if (charge) {
                    successMsg = 'Sie haben die Buchung erfolgreich abgeschlossen';
                    res.redirect('/bookingsuccess');
                    console.log(sourceFile.senderID);
                    sendBookingConfirmation(sourceFile.senderID, checkoutDataName, checkoutDataAddress, numberOfPersonsReservation, numberOfRoomsReservation, arrivalDateReservation, departureDateReservation, totalPriceChargeReservationInt);
                    sendPDF(sourceFile.senderID);
                }
            });
        }
    }, 20000);
});

//Broadcast gesendet von Dashboard to all angemeldete Gäste
function sendBroadcast(recipientId, broadcastText) {
    console.log("---->>>>>recipientId: in send broadcast function: "  + recipientId);
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: broadcastText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };
    sourceFile.callSendAPI(messageData);
}

//Broadcast gesendet von Dashboard to all angemeldete Gäste - Wenn Anhang hochgeladen, diese function wird gecalled
function sendBroadcastFile(recipientId, URLUploadedFile) {
    var messageData;
    var imageEnding = "jpg";
    var imageEnding2 = "png";
    console.log("------->>>>>: " + URLUploadedFile);
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
        console.log("------->>>>>URL message attachet " + messageData.message.attachment.payload.url);
        sourceFile.callSendAPI(messageData);
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
        sourceFile.callSendAPI(messageData);
        console.log("------->>>>>URL message attachet " + messageData.message.attachment.payload.url);
    }

}

module.exports = router;