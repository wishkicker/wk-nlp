/**
 * Created with JetBrains WebStorm.
 * User: admin
 * Date: 11/25/13
 * Time: 1:03 PM
 * To change this template use File | Settings | File Templates.
 */


module.exports = function(provider){
    return require('./shopzillaAPI.js')(provider);
}