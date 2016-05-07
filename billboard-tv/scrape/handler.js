'use strict';

var Aws = require('../model/aws.js');
var s3_client = Aws.s3();

var Youtube = require('../model/youtube.js');
var youtube_client = Youtube.client();

var cheerio_httpclient = require('cheerio-httpcli');

function search_youtube_video_id(keyword, callback){
  youtube_client.search(keyword, 1, (error, result) => {
    if (error) { throw new Error(error); return; }
    if (result.items.length === 0) { callback(''); return; }
    
    var item = result["items"][0];
    var video_id = item["id"]["videoId"];
    callback(video_id);
  });
};

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

 
module.exports.handler = function(event, context, cb) {
  
  // var slack_client = require('../../lib/slack.js');
  
  var fetch_html = new Promise((resolve, reject) => {
    cheerio_httpclient.fetch('http://www.billboard.com/charts/hot-100', (error, $, res) => {
      if (error) { throw new Error(error); return; }
      resolve($);
    });
  });
  
  fetch_html.then(($) => {
    return new Promise((resolve, reject) => {
      var date = $('.chart-data-header time').text();
      var json = {};
      json['date'] = date;
      var ranking_array = [];
      var ranking_dom = $('.chart-row');
      ranking_dom.each((i, obj) => {
        var title  = splitter($(obj).find('.chart-row__song').text());
        var artist = splitter($(obj).find('.chart-row__artist').text());
        var rank   = splitter($(obj).find('.chart-row__current-week').text());
        // console.log('rank:' + rank);
        // console.log('title:' + title);
        // console.log('artist:' + artist);
        
        search_youtube_video_id(artist + ' ' + title, (video_id) => {
          var record = {
            'rank': rank,
            'artist': artist,
            'title': title,
            'video_id': video_id
          };
          ranking_array.push(record);
          
          if (ranking_array.length === ranking_dom.length) {
            ranking_array.sort((a, b) => {
              if (Number(a['rank']) > Number(b['rank'])) return 1;
              else return -1;
            });
            json['ranking'] = ranking_array;
            resolve(json);
          }
        });
      });
    });
  })
  .then((json) => {
    s3_client.putObject(build_s3_param(json), (error, data) => {
      if (error) { throw new Error(error); return; }
      // slack_client.post('update ranking json success!!');
      cb(null, 'update ranking json success!!');
    });
  })
  .catch((error) => {
    console.error(error);
    // slack_client.post('update ranking json finish with error: ' + JSON.stringify(error));
    cb(null, 'update ranking json finish with error: ' + JSON.stringify(error));
  });
};
