'use strict';

var http_client = require('superagent');
var Async = require('async');
var Youtube = require('../model/youtube.js');

function serialVideoInsert(ranking_json, youtube_client, playlist_id, loop_count, callback){
  var video_id = ranking_json.ranking[loop_count].video_id;
  youtube_client.insertVideo(playlist_id, video_id, (err) => {
    if (err) throw new Error(err);
    
    console.log('loop_count', loop_count);
    if (loop_count === ranking_json.ranking.length - 1) {
      callback();
    } else {
      serialVideoInsert(ranking_json, youtube_client, playlist_id, loop_count+1, callback);
    }
  });
}
  
module.exports.handler = function(event, context, cb){
  
  var youtube_client;
  
  Async.waterfall([
    (callback) => {
      console.log('http request');
      http_client.get('http://billboard-tv.tk/ranking.json')
      .end((err, res) => {
        if (err) throw new Error(err);
        callback(null, JSON.parse(res.text));
      });
    },
  
    (ranking_json, callback) => {
      console.log('youtube oauth');
      youtube_client = new Youtube((err) => {
        if (err) throw new Error(err);
        callback(null, ranking_json);
      });
    },
  
    (ranking_json, callback) => {
      console.log('playlist exist');
      var playlist_title = 'Billboard Hot 100 Music Videos - ' + ranking_json['date'];
  
      youtube_client.isExistPlaylist(playlist_title, (err, is_exist) => {
        if (err) throw new Error(err);
        if (is_exist) {
          return cb(null, 'Playlist already exist. Nothing todo');
        } else {
          callback(null, ranking_json, playlist_title);
        }
      });
    },
  
    (ranking_json, playlist_title, callback) => {
      console.log('create playlist');
      youtube_client.insertPlaylist(playlist_title, (err, playlist_id) => {
        if (err) throw new Error(err);
        callback(null, ranking_json, playlist_id);
      });
    },
  
    (ranking_json, playlist_id, callback) => {
      console.log('insert videos');
      serialVideoInsert(ranking_json, youtube_client, playlist_id, 0, () => {
        callback();
      });
    }
  
  ], (err) => {
    if (err) throw new Error(err);
    cb(null, 'finish successfully');
  });
};
