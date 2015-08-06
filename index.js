// Include modules
// ---------------------------------------------------------------------------
var request = require('superagent');
var gm = require('gm');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3Stream = require('s3-upload-stream')(new AWS.S3());



// Define functions
// ---------------------------------------------------------------------------
function eliminateDuplicates(arr) {
  var i;
  var len=arr.length;
  var out=[];
  var obj={};

  for (i=0;i<len;i++) {
    obj[arr[i]]=0;
  }
  for (i in obj) {
    out.push(i);
  }
  return out;
}


function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


var startTime = '';
var endTime = '';
function generateSupporterImage(eventIndex) {
  var campaignUids = events[eventIndex].campaignUids.join(',');
  var eventName = events[eventIndex].name;

  startTime = new Date();
  console.log('------------------------------------------------------------------------------');
  console.log(eventName+' | START TILE GENERATION ('+campaignUids+') | '+startTime.toLocaleString());


  console.log(eventName+' | Getting images from the API... | '+new Date().toLocaleString());

  // Get the JSON
  request.get("https://everydayhero.com/api/v2/pages/?campaign_id="+campaignUids+"&type=individual&limit=300&page=1").end(function(err, data) {
    if (err === null) {
      data = JSON.parse(data.res.text);

      // Get all the real image URLs
      var images = [];
      var completedRequests = 0;
      for (var key in data.pages) {
        var imageURL = data.pages[key].image.large_image_url;
        if (imageURL.indexOf('missing.gif') === -1) {
          request.head(imageURL).end(function(err, res) {
            if (!err) {
              images.push(res.request.url);
            }
            completedRequests++;
            if (completedRequests === data.pages.length) {
              doImageGeneration(images, eventIndex);
            }
          });
        } else {
          completedRequests++;
          if (completedRequests === data.pages.length) {
            doImageGeneration(images, eventIndex);
          }
        }
      }

    } else {
      console.log(eventName+' | API ERROR: '+err+' | '+new Date().toLocaleString());
      return startProcess();
    }
  });
}


function doImageGeneration(images, eventIndex) {
  var eventName = events[eventIndex].name;

  // Remove any potential duplicate images (only removes if they use the exact same URL)
  images = eliminateDuplicates(images);

  // Randomise the order
  images = shuffle(images);

  console.log(eventName+' | Success! Total images: '+images.length+' | '+new Date().toLocaleString());

  if (images.length > 80) {
    images = images.slice(0,80);
    console.log(eventName+' | Generating random 80 supporter image tile and saving to server.. | '+new Date().toLocaleString());
  } else if (images.length > 40) { // Count the images, are there more than 40?
    images = images.slice(0,40);
    console.log(eventName+' | Generating random 40 supporter image tile and saving to server... | '+new Date().toLocaleString());
  } else { // If there's less than 40
    // Done
    console.log(eventName+' | Less than 40 images, so we no tile will be generated :( | '+new Date().toLocaleString());
    return startProcess();
  }


  // Create and save the stitched image
  var row = 0;
  var col = 0;
  var imageWidth = 71;
  var imageHeight = 71;

  var image = gm();
  for (var i = 0; i < images.length; i++) {
    image.in('-modulate', '80,30');
    image.in('-page', '+'+(col * imageWidth)+'+'+(row * imageHeight));
    image.in(images[i].replace('https:', 'http:'));
    image.in('-resize', (imageWidth+1)+'x'+(imageHeight+1));

    col++;
    if (col >= 10) {
      col = 0;
      row++;
    }
  }
  image.mosaic();





  // This uploads the stream of the image to S3. That works fine, but the image it uploads is corrupted / broken / incomplete?
  // ------------------------------------------------------------------------------------------------------------
  image.stream(function(err, stdout, stderr) {
    var buf = new Buffer(0);
    stdout.on('data', function(data) {
      buf = Buffer.concat([buf, data]);
    });

    stdout.on('end', function() {
      var data = {
        Bucket: "edh-widgets/supporter-tiles/img",
        Key: eventName+".jpg",
        Body: buf,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
        ContentLength: stdout.bytesRead
      };
      S3.putObject(data, function(err, res) {
        if (err) {
         console.log(err);
        } else {
          console.log(res);
        }
      });
    });

  });
  // ------------------------------------------------------------------------------------------------------------




  // This alternative example saves the image locally. This works fine.
  // -------------------------------------------------------
  // image.write('img/'+eventName+'.jpg', function (err) {
  //   if (err) {
  //     console.log(eventName+' | WRITE ERROR: '+err+' | '+new Date().toLocaleString());
  //   } else {
  //     console.log(eventName+' | SUCCESS! | '+new Date().toLocaleString());

  //     endTime = new Date();
  //     console.log(eventName+' | END TILE GENERATION | Total time: '+((endTime.getTime() - startTime.getTime()) / 1000)+'s | '+new Date().toLocaleString());
  //   }

  //   startProcess();
  // });
  // -------------------------------------------------------





}


// Function to start the image generation
var eventToProcess = 0;
function startProcess() {
  // If this index doesn't exist, go back to the beginning
  if (!events[eventToProcess]) {
    eventToProcess = 0;
  } else {
    generateSupporterImage(eventToProcess);
    eventToProcess++;
  }
}



// Get config from S3 and start script
// ---------------------------------------------------------------------------

console.log('------------------------------------------------------------------------------');
console.log('Get config from S3... (edh-widgets/supporter-tiles/config.js) | '+new Date().toLocaleString());

var events = {};
var S3 = new AWS.S3();
var params = {Bucket: 'edh-widgets/supporter-tiles', Key: 'config.js'}
S3.getObject(params, function(err, data) {
  if (err) {
    console.log('CONFIG FAILED TO LOAD | '+err+' | '+new Date().toLocaleString());
  }
  else {
    console.log('Success! | '+new Date().toLocaleString());
    var config = data.Body.toString();
    events = JSON.parse(config).events;

    startProcess(); // Start the script
  }
});
