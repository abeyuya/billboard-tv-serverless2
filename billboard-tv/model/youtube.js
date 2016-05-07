'use strict';

var Youtube = require('youtube-node');
var youtube_client = (() => {
  var youtube_client = new Youtube();
  youtube_client.setKey(process.env.YOUTUBE_API_KEY);
  youtube_client.addParam('order', 'relevance');
  youtube_client.addParam('type', 'video');
  return youtube_client;
})();

module.exports = class Youtube {
  static client(){
    return youtube_client;
  }
}
