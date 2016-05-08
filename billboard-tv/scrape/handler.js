'use strict';

var Aws = require('../model/aws.js');
var s3_client = Aws.s3();
var Youtube = require('../model/youtube.js');
var cheerio_httpclient = require('cheerio-httpcli');
var Async = require('async');

function splitter(string){
  return string.replace(/\t/g , '').replace(/\n/g, '').trim();
};

function parseDom($, obj){
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
};

function serialVideoIDSearch(youtube_client, $, ranking_dom, loop_count, ranking_array, callback){
  var record = parseDom($, ranking_dom[loop_count]);
  youtube_client.search(record.artist + ' ' + record.title, (err, video_id) => {
    if (err) return callback(err);
    
    record.video_id = video_id;
    ranking_array.push(record);
    
    console.log('loop_count:', loop_count);
    if (loop_count === ranking_dom.length - 1) {
      ranking_array.sort((a, b) => {
        if (Number(a['rank']) > Number(b['rank'])) return 1;
        else return -1;
      });
      
      var json = {};
      json.ranking = ranking_array;
      callback(null, json);
    } else {
      loop_count++;
      serialVideoIDSearch(youtube_client, $, ranking_dom, loop_count, ranking_array, callback);
    }
  });
};

module.exports.handler = function(event, context, cb) {
  
  var youtube_client;
  
  Async.waterfall([
    
    (callback) => {
      console.log('init youtube_client');
      youtube_client = new Youtube((err) => {
        callback(err);
      });
    },
    
    (callback) => {
      console.log('fetch html');
      cheerio_httpclient.fetch('http://www.billboard.com/charts/hot-100', (err, $) => {
        callback(err, $);
      });
    },
    
    ($, callback) => {
      console.log('get video ids');
      var date = $('.chart-data-header time').text();
      var ranking_dom = $('.chart-row');
      
      serialVideoIDSearch(youtube_client, $, ranking_dom, 0, [], (err, json) => {
        json['date'] = date;
        callback(err, json);
      });
    },
    
    (json, callback) => {
      console.log('put to s3');
      s3_client.putObject(Aws.buildS3Param(json), (err, data) => {
        callback(err);
      });
    }
  ], (err) => {
    if (err) return cb(JSON.stringify(err));
    cb(null, 'update ranking json success!!');
  });
};
