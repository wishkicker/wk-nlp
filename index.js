require('./categoriesMap.js');

var fs = require('fs');
global.keys = (global.keys) ? global.keys : {};

var keysSchema = [
    "shopzillaApiKey",
    "shopzillaPublisherID",
    "shoppingApiKey",
    "shoppingTrackingId",
];

var data = JSON.parse(fs.readFileSync(__dirname+"/keys.loc"));
keysSchema.map(function(item){
    if (!data[item]) throw 'SECURITY ERROR: Your keys.loc file is not at the right version!!! you are missing keys!!!'
});
global.keys['apiKey'] = data['shopzillaApiKey'];
global.keys['publisherId'] = data['shopzillaPublisherID'];
global.keys['shoppingApiKey'] = data['shoppingApiKey'];
global.keys['shoppingTrackingId']= data['shoppingTrackingId'];

module.exports = function(provider) {
    return require('./shopzillaAPI.js')(provider);
}