/**
 * User: Tzali
 * Date: 10/24/12
 * This file gives API for connecting to Shopzilla
 */

/// requires
var async=require('async');
var http = require('http'),
    _ = require('underscore'),
    decoder = new (require('string_decoder').StringDecoder)('utf8');

/// local objects
var requestRetryCount= 5,
    shopzillaHost = 'http://catalog.bizrate.com/',
    productApiPath = 'services/catalog/v1/us/product?',
    attributesPath = 'services/catalog/v1/us/attributes?',
    taxonomyPath = 'services/catalog/v1/us/taxonomy?';
apiBase =  {
    apiKey : 'c84c5343e65de87f1c78e9e2abec8a92'
    ,   publisherId :  602968
    ,   placementId : 1
    ,   format : 'json'
};

//Dictionary of attributes standardization
var attributeStandards = {
    'flat panel': 'flat screen'
}

//todo: move to config file
var SUFFICIENT_PROBABILITY = 0.8,
    MAX_CATEGORIES = 15,
    MAX_SEARCH_CATEGORIES = 50,
    DICTIONARY_CATEGORIES_COUNT = 10;


/// local functions
var createQsFromObject = function (object){
        var qs = '';
        //add the query string params
        _.each(object, function(value, key){
            qs += key + '=' + encodeURI( value )+ '&';
        });
        return qs;
    },
    ShopzillaApiCall = function (path, query, template, callback) {
        var buffer = '';
        var results;

        query.keyword = template.term || '';
        query.categoryId = template.categoryId || '';
        var tries = 0, done = undefined;
        var startTime = Date.now();
        async.timesSeries(requestRetryCount, function(n, next) {
            if (!done) {
                http.get(shopzillaHost + path + createQsFromObject(query), function(res) {
                    tries++;
                    res.on('data', function (chunk){
                        buffer += (decoder.write(chunk));
                    });

                    res.on('end', function (){
                        try {results = JSON.parse(buffer);} catch(err) {
                            results=[];
                        }
                        done=results;
                        global.monitor.timing(global.monitor.SHOPZILLA_RESPONSE_TIME, Date.now() - startTime);
                        next();
                    });

                }).on('error', function(e) {
                        next("Got error at shopzilla call: " + e.message, null);
                    });
            }
            else next();
        }, function(err){
            callback(err, results);
        });
    };


module.exports = exports = function(provider){
    exports.provider = provider;

    return {
        getCategoriesTree: function(results, callback) {
            var query = _.defaults({
                ancestors: ''
                ,results: results
                ,sort: 'name_asc'
                ,attFilter: ''}, apiBase);
            ShopzillaApiCall(taxonomyPath, query, {}, function(err, data){
                callback(err, data)
            });
        },
        getProducts: function (template, start, categoryId, callback){
            var query = _.extend({
                placementId : 1,
                productIdType : 'SZPID',
                categoryId: categoryId,
                offersOnly : true,
                biddedOnly : false,
                minPrice : '',
                maxPrice : '',
                start : start,
                results : 50,
                backfillResults : 0,
                startOffers : 0,
                resultsOffers : 0,
                sort : 'relevancy_desc',
                attributeId: '',
                resultsAttribute: 10,
//            showAttributes : true,
//            showProductAttributes : true,
                //minRelevancyScore : 1000,  //meshi: I removed it since there are terms that do not return any thing, and we are getting 250 results sorted by relevancy anyway..
                imageOnly : true}, apiBase);

            async.map(provider, function(company, cb) {
                providers[company](query, template, cb);
            }, function(err, replies){
                if (err) callback(err, template);
                else {
                    var results = [];
                    replies.map(function(arr){ results = results.concat(arr); });
                    template.results = results;
                    callback(null, template);
                }
            });
        },
        getAttributes: function (template, categoryId, callback){
            var query = _.defaults({
                attributeId: ''
                ,   attFilter: ''
                ,   categoryId: categoryId
                ,   sort: 'name_asc'
                ,   resultsAttributeValues: 10}, apiBase);
            if (template && template[0]) {
                template = template[0];
                ShopzillaApiCall(attributesPath, query, template, function (err, results){
                    if(err){
                        callback(err, null);
                    }
                    else if(results.attributes && results.attributes.attribute){
                        var attr = _.map(results.attributes.attribute , function (value, key) {
                            var maxAttrCount = 0;
                            var vals = _.map(value.attributeValues.attributeValue, function (attValue, index){
                                if ((maxAttrCount < attValue.count * 10)) {
                                    attValue.name=attValue.name.toLowerCase();
                                    if (attributeStandards[attValue.name]) attValue.name=attributeStandards[attValue.name];
                                    maxAttrCount = Math.max(maxAttrCount, attValue.count);
                                    return attValue.name;
                                }
                                else
                                    return null;
                            });
                            vals = _.reject(vals, function(v){ return !v });
                            return {name : value.name, values: vals};
                        })

                        attr = _.reject(attr, function (v){
                                return v.name == "Stores" ? true : false}
                        )

                        template.properties = attr

                        callback(null, template);
                    }
                    else {
                        callback(null, template);
                    }
                });
            }
            else callback(null, {});
        },
        getCategoryWithMaxProb : function (template, callback) {
            lib.getMaxCategories(template, null, 1, callback);
        },
        getSufficientProbCategory: function(term, callback){
            lib.getMaxCategories({term : term, user: "wishkicker"}, SUFFICIENT_PROBABILITY, MAX_CATEGORIES, callback);
        },
        getDictionaryEntryCategories: function(term, callback){
            lib.getMaxCategories({term : term, user: "wishkicker"}, null, DICTIONARY_CATEGORIES_COUNT, callback);
        },
        searchVendorCategories: function(term, callback) {
            lib.getMaxCategories({term: term, user: "wishkicker"}, SUFFICIENT_PROBABILITY, MAX_SEARCH_CATEGORIES, callback);
        },
        search : function (term, categoryId, user, callback){
            async.waterfall([
                function (cb){
                    cb(null, {term : term, user: user});
                },
                function(template, cb){
                    exports(provider).getCategoryWithMaxProb(template, cb);
                },
                function(template, cb){
                    exports(provider).getAttributes(template, categoryId, cb);
                }
            ],
                callback);
        }
    };
};

var lib = {
    getMaxCategories : function(template, suffProb, resCount, callback){
        var createRetObj = function(category){
            return {
                //term: term,
                categoryId: category.id,
                categoryName: category.name
            };
        };

        var query = _.defaults({
            ancestors: ''
            ,results: 10
            ,sort: 'probability_desc'
            ,attFilter: ''}, apiBase);

        ShopzillaApiCall(taxonomyPath, query, template, function (err, categories){
            if(err){
                callback("Got error: " + err.message, null);
            }
            else if(categories && categories.taxonomy && categories.taxonomy.categories.category && categories.taxonomy.categories.category.length>0){
                var categories = categories.taxonomy.categories.category,
                    category,
                    maxProb = 0,
                    ret;

                _.map (categories , function (value, key) {
                    if (value.probability > maxProb){
                        maxProb = value.probability;
                        category = value;
                    }
                    return;
                });

                if(suffProb && maxProb >= suffProb){
                    ret = createRetObj(category);

                    callback(null,[ret]);
                }
                else {
                    ret = [];
                    for (var i = 0; i < resCount && i < categories.length; i++){
                        ret.push(createRetObj(categories[i]));
                    }
                    callback(null, ret);
                }
            }
            else{
                callback(null, []);
            }
        });
    }
}

var providers = {
    'shopzilla': function(query, template, callback) {
        ShopzillaApiCall(productApiPath, query, template, function (err, products){
            if(err){
                callback("Got error at getProducts: " + err.message, null);
            }
            else if(products.offers && products.offers.offer){
                var results = products.offers.offer;
                callback(null, results);
            }
            else {
                callback(null, []);
            }
        });
    },
}
