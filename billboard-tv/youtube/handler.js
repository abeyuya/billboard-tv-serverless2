'use strict';

// var Promise = require("bluebird");
// var slack_client = require('../../lib/slack.js');

var Google = require('googleapis');
var youtube_client = Google.youtube('v3');
var http_client = require('superagent');

var oauth2Client = (function(){
  var OAuth2 = Google.auth.OAuth2;
  var oauth2Client = new OAuth2(
    process.env.GOOGLE_API_CLIENT_ID,
    process.env.GOOGLE_API_CLIENT_SECRET,
    process.env.GOOGLE_API_REDIRECT_URL
  );
  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_API_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_API_REFRESH_TOKEN,
  });
  return oauth2Client;
})();

var oauth = new Promise(function(resolve, reject){
  console.log('oauth');
  oauth2Client.refreshAccessToken(function(error, tokesn){
    oauth2Client.setCredentials(tokesn);
    if (error) { throw new Error(error); return; }
    resolve();
  });
});


module.exports.handler = function(event, context, cb) {

  var fetch_ranking_json = new Promise(function(resolve, reject){
    console.log('fetch_ranking_json');
    http_client.get('http://billboard-tv.tk/ranking.json')
    .end(function(error, res){
      if (error) { throw new Error(error); return; }
      resolve(JSON.parse(res.text));
    });
  });
  
  var insert_playlist_item = function(playlist_id, loop_count, callback){
    youtube_client.playlistItems.insert({
      auth: oauth2Client,
      part: 'snippet',
      resource: {
        snippet: {
          playlistId: playlist_id,
          resourceId: {
            videoId: ranking_json['ranking'][loop_count]['video_id'],
            kind: 'youtube#video'
          }
        }
      }
    }, function(error, res){
      if (error) {
        console.log('playlistItem insert error: ' + JSON.stringify(error));
      } else {
        console.log('loop_count: ' + loop_count + ', title: ' + res['snippet']['title']);
      }
      
      if (loop_count == 99) {
        callback();
      } else {
        insert_playlist_item(playlist_id, loop_count+1, callback);
      }
    });
  };
  
  var ranking_json = {};
  var playlist_title = '';
  
  oauth.then(function(){
    return fetch_ranking_json;
  }).then(function(ranking_json_res){
    console.log('get playlist');
    return new Promise(function(resolve, reject){
      ranking_json = ranking_json_res;
      playlist_title = 'Billboard Hot 100 Music Videos - ' + ranking_json['date'];
      
      youtube_client.playlists.list({
        auth: oauth2Client,
        part: 'snippet',
        channelId: 'UCm8HacZNgIMAv2zg3OxexGQ',
        maxResults: 50, // TODO: pagenation loop
        fields: 'items(id,snippet)'
      }, function(error, playlists_res){
        if (error) { console.log('youtube playlist request error: ' + JSON.stringify(error)); return; }
        if (playlists_res['items'].length === 0) { resolve(); return; }
        
        var loop_count = 0;
        playlists_res['items'].forEach(function(obj, i, arr){
          loop_count += 1;
          if (obj['snippet']['title'] === playlist_title) {
            cb(null, 'Nothing todo. Playlist has already created.');
            return true;
          }
          if (arr.length === loop_count) {
            resolve();
          }
        });
      });
    });
  })
  .then(function(debug_playlist_id){
    console.log('create playlist');
    return new Promise(function(resolve, reject){
      if (debug_playlist_id) { resolve(debug_playlist_id); return; }
      
      youtube_client.playlists.insert({
        auth: oauth2Client,
        part: 'snippet, status',
        resource: {
          snippet: {
            title: playlist_title,
            description: "Do you want to play without stop by video ads? Visit here. http://billboard-tv.tk \nIf there is a deleted videos in this playlist, it may not be enough to 100 songs.\n#Billboard"
          },
          status: {
            privacyStatus: 'public'
          }
        }
      }, function(error, res){
        if (error) {
          console.log('playlist insert error: ' + JSON.stringify(error));
          throw new Error(error);
          return;
        }
        resolve(res['id']);
      });
    });
  })
  .then(function(playlist_id){
    console.log('insert playlist items');
    return new Promise(function(resolve, reject){
      insert_playlist_item(playlist_id, 0, function(){
        resolve();
      });
    });
  })
  .then(function(){
    console.log('finish all');
    // slack_client.post('create new playlist success!!');
    cb(null, 'finish all');
  })
  .catch(function(error){
    console.error(error);
    // slack_client.post('create new playlist finish with error: ' + JSON.stringify(error));
    cb(null, 'create new playlist finish with error: ' + JSON.stringify(error));
  });
};
