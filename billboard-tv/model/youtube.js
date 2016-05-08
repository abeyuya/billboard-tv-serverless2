'use strict';

var Google = require('googleapis');
var youtube_client = Google.youtube('v3');

var oauth2Client = (() => {
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

module.exports = class Youtube {
  
  constructor(callback){
    oauth2Client.refreshAccessToken((err, tokens) => {
      oauth2Client.setCredentials(tokens);
      callback(err);
    });
  }
  
  search(keyword, callback){
    var param = {
      auth: oauth2Client,
      part: 'snippet',
      maxResults: 1,
      q: keyword,
      type: 'video',
      videoEmbeddable: 'true',
      order: 'relevance'
    };
    
    youtube_client.search.list(param, (err, res) => {
      if (err) return callback(err);
      if (res.items.length === 0) return callback(null, '');
      
      callback(null, res.items[0]['id']['videoId']);
    });
  }
  
  insertPlaylist(title, callback){
    var param = {
      auth: oauth2Client,
      part: 'snippet, status',
      resource: {
        snippet: {
          title: title,
          description: "Do you want to play without stop by video ads? Visit here. http://billboard-tv.tk #Billboard"
        },
        status: {
          privacyStatus: 'public'
        }
      }
    };
    
    youtube_client.playlists.insert(param, (err, res) => {
      callback(err, res['id']);
    });
  }
  
  insertVideo(playlist_id, video_id, callback){
    var param = {
      auth: oauth2Client,
      part: 'snippet',
      resource: {
        snippet: {
          playlistId: playlist_id,
          resourceId: {
            videoId: video_id,
            kind: 'youtube#video'
          }
        }
      }
    };
    
    youtube_client.playlistItems.insert(param, (err, res) => {
      callback(err);
    });
  }
  
  isExistPlaylist(playlist_title, callback){
    var param = {
      auth: oauth2Client,
      part: 'snippet',
      channelId: 'UCm8HacZNgIMAv2zg3OxexGQ',
      maxResults: 50, // TODO: pagenation loop
      fields: 'items(id,snippet)'
    };
    
    youtube_client.playlists.list(param, (err, res) => {
      if (err) return callback(err);
      if (res.items.length === 0) return callback(null, false);
      
      for (var i = 0; i < res.items.length; i++) {
        if (res.items[i]['snippet']['title'] === playlist_title) {
          return callback(null, true);
        }
        
        if (i === res.items.length - 1) return callback(null, false);
      }
    });
  }
}
