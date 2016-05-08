'use strict';

var AWS = require('aws-sdk');
AWS.config.update({
  'accessKeyId': process.env.BILLBOARD_TV_AWS_ACCESS_KEY_ID,
  'secretAccessKey': process.env.BILLBOARD_TV_AWS_SECRET_ACCESS_KEY,
  'region': process.env.SERVERLESS_REGION
});

module.exports = class Aws {
  
  static s3(){
    return new AWS.S3();
  }
  
  static buildS3Param(json){
    return {
      'Bucket': 'billboard-tv.tk',
      'Key': 'ranking.json',
      'ACL': 'public-read',
      'Body': JSON.stringify(json),
      ContentType: 'application/json'
    };
  }
}
