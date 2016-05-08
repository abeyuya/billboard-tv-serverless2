'use strict';

var Aws = require('../model/aws.js');
var s3_client = Aws.s3();
var Youtube = require('../model/youtube.js');
var cheerio_httpclient = require('cheerio-httpcli');
var Async = require('async');

function splitter(string){
  return string.replace(/\t/g , '').replace(/\n/g, '').trim();
};

function build_s3_param(json){
  var body = JSON.stringify(json);
  var params = {
    'Bucket': 'billboard-tv.tk',
    'Key': 'ranking.json',
    'ACL': 'public-read',
    'Body': body,
    ContentType: 'application/json',
  };
  return params;
};

function parse_dom($, obj){
  var title  = splitter($(obj).find('.chart-row__song').text());
  var artist = splitter($(obj).find('.chart-row__artist').text());
  var rank   = splitter($(obj).find('.chart-row__current-week').text());
  // console.log('rank:' + rank);
  // console.log('title:' + title);
  // console.log('artist:' + artist);
  
  return {
    title: title,
    artist: artist,
    rank: rank
  };
}

function serialFetchVideoInfo(record, loop_count){
  // var record = parse_dom($, ranking_dom[loop_count]);
  youtube_client.search(record.artist + ' ' + record.title, (err, video_id) => {
    if (err) throw new Error(err);
    
    record.video_id = video_id;
    ranking_array.push(record);
    
    console.log('i:', i, 'ranking_dom.length:', ranking_dom.length);
    if (i === ranking_dom.length - 1) {
      ranking_array.sort((a, b) => {
        if (Number(a['rank']) > Number(b['rank'])) return 1;
        else return -1;
      });
      json['ranking'] = ranking_array;
      callback(null, json);
    }
  });
}
 
module.exports.handler = function(event, context, cb) {
  
  var youtube_client;
  
  Async.waterfall([
    
    (callback) => {
      console.log('init youtube_client');
      youtube_client = new Youtube((err) => {
        if (err) throw new Error(err);
        callback(null);
      });
    },
    
    (callback) => {
      console.log('fetch html');
      cheerio_httpclient.fetch('http://www.billboard.com/charts/hot-100', (err, $) => {
        if (err) throw new Error(err);
        callback(null, $);
      });
    },
    
    ($, callback) => {
      console.log('get video ids');
      var date = $('.chart-data-header time').text();
      var json = {};
      json['date'] = date;
      var ranking_array = [];
      var ranking_dom = $('.chart-row');
      
      for (var i = 0; i < ranking_dom.length; i++) {
        var record = parse_dom($, ranking_dom[i]);
        youtube_client.search(record.artist + ' ' + record.title, (err, video_id) => {
          if (err) throw new Error(err);
          
          record.video_id = video_id;
          ranking_array.push(record);
          
          console.log('i:', i, 'ranking_dom.length:', ranking_dom.length);
          if (i === ranking_dom.length - 1) {
            ranking_array.sort((a, b) => {
              if (Number(a['rank']) > Number(b['rank'])) return 1;
              else return -1;
            });
            json['ranking'] = ranking_array;
            callback(null, json);
          }
        });
      }
    },
    
    (json, callback) => {
      console.log('put to s3');
      s3_client.putObject(build_s3_param(json), (err, data) => {
        console.log('data:', data);
        callback(err);
      });
    }
  ], (err) => {
    // if (err) throw new Error(err);
    cb(null, 'update ranking json success!!');
  });
};
