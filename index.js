require('./categoriesMap.js');

var fs = require('fs');
global.keys = (global.keys) ? global.keys : {};

var data = JSON.parse(fs.readFileSync(__dirname+"/keys.loc"));
console.log('read keys from file '+__dirname+"/keys.loc"+': '+JSON.stringify(data));
global.keys['apiKey'] = data['shopzillaApiKey'];
global.keys['publisherId'] = data['shopzillaPublisherID'];
global.keys['shoppingApiKey'] = data['shoppingApiKey'];
global.keys['shoppingTrackingId']= data['shoppingTrackingId'];

if (!global.keys['apiKey'] || !global.keys['publisherId'] || !global.keys['shoppingApiKey'] || !global.keys['shoppingTrackingId']) {
    throw 'Your keys.loc file is not at the right version!!! it is missing important keys!!!';
}

module.exports = function(provider) {
    return require('./shopzillaAPI.js')(provider);
}