require('./categoriesMap.js');

var fs = require('fs');
global.keys = (global.keys) ? global.keys : {};

var data = JSON.parse(fs.readFileSync(__dirname+"/keys.loc"));
console.log('read keys from file '+__dirname+"/keys.loc"+': '+JSON.stringify(data));
global.keys['apiKey'] = data['shopzillaApiKey'];
global.keys['publisherId'] = data['shopzillaPublisherID'];
global.keys['shoppingApiKey'] = data['shoppingApiKey'];
global.keys['shoppingTrackingId']= data['shoppingTrackingId'];
module.exports = function(provider) {
    return require('./shopzillaAPI.js')(provider);
}