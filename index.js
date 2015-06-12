var events = require('./config');
var request = require('superagent');
var gm = require('gm');
var fs = require('fs');



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



function generateSupporterImage(eventIndex) {
  var campaignUids = events[eventIndex].campaignUids.join(',');
  var eventName = events[eventIndex].name;



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
      console.log('API ERROR!!!111oneoneone (Event Name: '+eventName+')');
    }
  });
}



function doImageGeneration(images, eventIndex) {
  var eventName = events[eventIndex].name;

  // Remove any potential duplicate images (only removes if they use the exact same URL)
  images = eliminateDuplicates(images);

  // Randomise the order
  images = shuffle(images);


  // Count the images, are there more than 80?
  if (images.length > 80) {
    images = images.slice(0,80);
  } else if (images.length > 40) { // Count the images, are there more than 40?
    images = images.slice(0,40);
  } else { // If there's less than 40
    // Increment the eventToProcess.txt
    fs.writeFile("eventToProcess.txt", (parseInt(eventIndex) + 1), function(err) {
      if (err) {
        return console.log(err);
      }
    });

    // Done
    return;
  }


  // Create and save the stitched image
  var row = 0;
  var col = 0;
  var imageWidth = 71;
  var imageHeight = 71;

  var image = gm();
  for (var i = 0; i < images.length; i++) {
    image.in('-page', '+'+(col * imageWidth)+'+'+(row * imageHeight))
    image.in(images[i].replace('https:', 'http:'))
    image.in('-resize', (imageWidth+1)+'x'+(imageHeight+1))

    col++;
    if (col >= 10) {
      col = 0;
      row++;
    }
  }
  image.mosaic();
  image.write('img/'+eventName+'.jpg', function (err) {
    if (err) {
      console.log(err);
    } else { // If it wrote the file successfully
      // Increment the eventToProcess.txt
      fs.writeFile("eventToProcess.txt", (parseInt(eventIndex) + 1), function(err) {
        if (err) {
          return console.log(err);
        }
      });
    }
  })
}



// Function to open the eventToProcess.txt file and start the image generation
var eventToProcess = 0;
function startProcess() {

  fs.readFile('eventToProcess.txt', 'utf8', function (err, data) {
    if (err) {
      console.log(err);
    } else {
      eventToProcess = data.toString();

      // If this index doesn't exist, go back to the beginning
      if (!events[eventToProcess]) {
        fs.writeFile("eventToProcess.txt", 0, function(err) {
          if (err) {
            console.log(err);
          } else {
            eventToProcess = 0;
            generateSupporterImage(eventToProcess);
          }
        });
      } else {
        generateSupporterImage(eventToProcess);
      }
    }
  });
}



// Does the eventToProcess.txt file exist? If not, make it.
// Also...start the process.
fs.exists('eventToProcess.txt', function (exists) {
  if (!exists) {
    fs.writeFile("eventToProcess.txt", 0, function(err) {
      if (err) {
        console.log(err);
      } else {
        startProcess();
      }
    });
  } else {
    startProcess();
  }
});



// CLEANUP SCRIPT: Remove any images from the server that are no longer in the events config
// For each file in the img dir, if it's not in the events obj (defined at the top of this file in the config) - delete it
fs.readdir('img', function (err, files) {
  if (err) {
    console.log(err);
  } else {
    for (var key in files) {
      var deleteFile = true;
      for (var key2 in events) {
        if (events[key2].name === files[key].replace('.jpg', '')) {
          deleteFile = false;
        }
      }

      if (deleteFile === true) {
        fs.unlink('img/'+files[key], function (err) {
          if (err) {
            console.log(err);
          }
        });
      }
    }
  }
});
