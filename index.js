/**
 * Created with JetBrains WebStorm.
 * User: admin
 * Date: 11/25/13
 * Time: 1:03 PM
 * To change this template use File | Settings | File Templates.
 */

require('./categoriesMap.js');

/*
 global.shopzillaMonitor = new StatsD({host: 'monitor.wishkicker.com',
 //port: 8125,
 prefix: (process.env.NODE_ENV || 'dev') + '.WK.NLP',
 dnsCache: true});
 */

module.exports = function(provider){
    return require('./shopzillaAPI.js')(provider);
}