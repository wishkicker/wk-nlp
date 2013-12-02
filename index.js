/**
 * Created with JetBrains WebStorm.
 * User: admin
 * Date: 11/25/13
 * Time: 1:03 PM
 * To change this template use File | Settings | File Templates.
 */

require('./categoriesMap.js');

var fs = require('fs');
global.keys = (global.keys) ? global.keys : {};

var data = JSON.parse(fs.readFileSync(__dirname+"/keys.loc"));
global.keys['apiKey'] = data['shopzillaApiKey'];
global.keys['publisherId'] = data['shopzillaPublisherID'];
module.exports = function(provider) {
    return require('./shopzillaAPI.js')(provider);
}