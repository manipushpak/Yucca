const express = require('express');
const Twilio = require('twilio');
const extName = require('ext-name');
const urlUtil = require('url');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const config = require('../config');
var ExifImage = require('exif').ExifImage;
const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore({});
const request = require('request');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage({});

const PUBLIC_DIR = './public/mms_images';
const { twilioPhoneNumber, twilioAccountSid, twilioAuthToken } = config;
const { MessagingResponse } = Twilio.twiml;
const { NODE_ENV } = process.env;

function MessagingRouter() {
  let twilioClient;
  let images = [];
  let latitude;
  let longitude;
  let mediaSid;

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(path.resolve(PUBLIC_DIR));
  }

  function getTwilioClient() {
    return twilioClient || new Twilio(twilioAccountSid, twilioAuthToken);
  }

  function deleteMediaItem(mediaItem) {
    const client = getTwilioClient();

    return client
      .api.accounts(twilioAccountSid)
      .messages(mediaItem.MessageSid)
      .media(mediaItem.mediaSid).remove();
  }

  async function SaveMedia(mediaItem) {
    const { mediaUrl, filename } = mediaItem;
    if (NODE_ENV !== 'test') {
      const fullPath = path.resolve(`${PUBLIC_DIR}/${filename}`);

      if (!fs.existsSync(fullPath)) {
        const response = await fetch(mediaUrl);
        const fileStream = fs.createWriteStream(fullPath);

        response.body.pipe(fileStream);

        //deleteMediaItem(mediaItem);
      }

      try {
        //var lalala = "./public/mms_images/"+ filename;
        //var lalala = mediaUrl + ".json";
        var request = require('request').defaults({ encoding: null });
        request.get(mediaUrl, function (err, res, body) {
              //process exif here
              new ExifImage({ image : body }, function (error, exifData) {
              if (error)
                  console.log('Error: '+error.message);
              else
                  console.log(exifData); // Do something with your data!
          });
        });
      } catch (error) {
          console.log('Error: ' + error.message);
      }

      images.push(filename);
    }
  }


  async function handleIncomingSMS(req, res) {
    const { body } = req;
    const { NumMedia, From: SenderNumber, MessageSid } = body;
    let saveOperations = [];
    const mediaItems = [];

    if(NumMedia != 0) {
      let mediaUrl;
      for (var i = 0; i < NumMedia; i++) {  // eslint-disable-line
        mediaUrl = body[`MediaUrl${i}`];
        const contentType = body[`MediaContentType${i}`];
        const extension = extName.mime(contentType)[0].ext;
        mediaSid = path.basename(urlUtil.parse(mediaUrl).pathname);
        const filename = `${mediaSid}.${extension}`;

        console.log('Media url: '+mediaUrl);

        mediaItems.push({ mediaSid, MessageSid, mediaUrl, filename });
        saveOperations = mediaItems.map(mediaItem => SaveMedia(mediaItem));
      }

      await Promise.all(saveOperations);

      const messageBody = NumMedia === 0 ?
      'Send us an image!' :
      `Thanks for sending us ${NumMedia} file(s)`;

      const response = new MessagingResponse();
      response.message({
        from: twilioPhoneNumber,
        to: SenderNumber,
      }, messageBody);

      //add image to bucket
      const req = request(mediaUrl);
      req.pause();
      req.on('response', res => {

        // Don't set up the pipe to the write stream unless the status is ok.
        // See https://stackoverflow.com/a/26163128/2669960 for details.
        if (res.statusCode !== 200) {
          return;
        }

        const writeStream = storage.bucket("ramranch-images").file(mediaSid)
          .createWriteStream({

            // Tweak the config options as desired.
            gzip: true,
            public: true,
            metadata: {
              contentType: res.headers['content-type']
            }
          });
        req.pipe(writeStream)
          .on('finish', () => console.log('saved'))
          .on('error', err => {
            writeStream.end();
            console.error(err);
          });

        // Resume only when the pipe is set up.
        req.resume();
      });
      req.on('error', err => console.error(err));

      return res.send(response.toString()).status(200);
    }
    else {
      const coordinates = body['Body'];
      console.log('Text message: ' + coordinates);

      if(coordinates.indexOf(' ') >= 0) {
        const messageBody = NumMedia === 0 ?
        'Send us coordinates!' :
        `Thanks for sending us the coordinates of the trash`;

        const response = new MessagingResponse();
        response.message({
          from: twilioPhoneNumber,
          to: SenderNumber,
        }, messageBody);

        const lat = coordinates.split(" ");
        latitude = parseFloat(lat[0]);
        longitude = parseFloat(lat[1]);
        console.log('Latitude: ' + latitude);
        console.log('Longitude: ' + longitude);

        const siteKey = datastore.key('trash-site');
        var site = {
          'photo-id' : mediaSid,
          'location' : {
            'latitude' : latitude,
            'longitude' : longitude
          },
          'clean' : false,
        }
        var entity = {
          key: siteKey,
          data: site,
        }
        datastore.insert(entity);

        return res.send(response.toString()).status(200);
      }
      else {
        const messageBody = NumMedia === 0 ?
        'Send us coordinates!' :
        `Those coordinates don't seem to be properly formatted. Please send coordinates again!`;

        const response = new MessagingResponse();
        response.message({
          from: twilioPhoneNumber,
          to: SenderNumber,
        }, messageBody);

        return res.send(response.toString()).status(200);
      }
    }
  }


  function getRecentImages() {
    return images;
  }

  function clearRecentImages() {
    images = [];
  }

  function fetchRecentImages(req, res) {
    res.status(200).send(getRecentImages());
    clearRecentImages();
  }

  /**
   * Initialize router and define routes.
   */
  const router = express.Router();
  router.post('/incoming', handleIncomingSMS);
  router.get('/config', (req, res) => {
    res.status(200).send({ twilioPhoneNumber });
  });
  router.get('/images', fetchRecentImages);

  return router;
}

module.exports = {
  MessagingRouter,
};
