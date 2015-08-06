# Generate Supporter Images
Generates supporter images and uploads them to S3 for use in Event Footprints (see repository "event-footprint")

## How it works
This script is written with node js. It is called every 24 hours via Heroku (which passes in AWS credentials as environment variables). It then generates all required supporter images and uploads them to `https://s3.amazonaws.com/edh-widgets/supporter-tiles/img/clientName.jpg`

To test this script locally, run this command:
```
AWS_ACCESS_KEY_ID=your_id_here AWS_SECRET_ACCESS_KEY=your_key_here node index.js
```

## How to configure it
Configuration is done via `config.js`. After editing, this file needs to be uploaded to `edh-widgets/supporter-images/config.js`
