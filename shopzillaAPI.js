/**
 * User: Tzali
 * Date: 10/24/12
 * This file gives API for connecting to Shopzilla
 */

/// requires
var async=require('async');
var http = require('http'),
    _ = require('underscore'),
    check = require('validator').check,
    decoder = new (require('string_decoder').StringDecoder)('utf8');

/// local objects
var requestRetryCount= 5,
    shopzillaHost = 'http://catalog.bizrate.com/',
    productApiPath = 'services/catalog/v1/us/product?',
    attributesPath = 'services/catalog/v1/us/attributes?',
    taxonomyPath = 'services/catalog/v1/us/taxonomy?';
apiBase =  {
    apiKey : global.keys['apiKey']
    ,   publisherId :  global.keys['publisherId']
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
        var url = shopzillaHost + path + createQsFromObject(query);
        async.timesSeries(requestRetryCount, function(n, next) {
            if (!done) {
                http.get(url, function(res) {
                    tries++;
                    res.on('data', function (chunk){
                        buffer += (decoder.write(chunk));
                    });

                    res.on('end', function (){
                        try {results = JSON.parse(buffer);} catch(err) {
                            results=[];
                        }
                        done=results;
                        next();
                    });

                }).on('error', function(e) {
                        next("Got error at shopzilla call: " + e.message, null);
                    });
            }
            else next();
        }, function(err){
            console.log("shopzilla call "+url+" returned   //elapsed "+(Date.now()-startTime));
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
            var results = {products: {}, list: {}, count: 0};
            template.categoryId = categoryId;
            template.start = start;
            async.map(_.keys(provider), function(company, cb) {
                if (company!='wishkicker') providers[company](template, results, cb);
                else cb();
            }, function(err, replies){
                if (err) callback(err, template);
                else callback(null, results);
            });
        },
        getAttributes: function (template, categoryId, callback){
            var query = _.defaults({
                attributeId: ''
                ,   attFilter: ''
                ,   categoryId: categoryId
                ,   sort: 'name_asc'
                ,   resultsAttributeValues: 10}, apiBase);
            if (template) {
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
            exports(provider).getAttributes({term: term, user: user}, categoryId, callback);
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
            else if(categories && categories.taxonomy && categories.taxonomy.categories && categories.taxonomy.categories.category && categories.taxonomy.categories.category.length>0){
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
    'shopzilla': function(template, reply, callback) {
        var query = _.extend({
            placementId : 1,
            productIdType : 'SZPID',
            categoryId: template.categoryId,
            offersOnly : true,
            biddedOnly : false,
            minPrice : '',
            maxPrice : '',
            start : template.start,
            results : exports.provider['shopzilla'] || 0,
            backfillResults : 0,
            startOffers : 0,
            resultsOffers : 0,
            sort : 'relevancy_desc',
            attributeId: '',
            resultsAttribute: 10,
            imageOnly : true}, apiBase);

        ShopzillaApiCall(productApiPath, query, template, function (err, products){
            if(err){
                callback("Got error at shopzilla products: " + err.message, null);
            }
            else if(products.offers && products.offers.offer){
                var usedIds = {};
                standardResults(products.offers.offer, usedIds, reply, unifiers['shopzilla']);
                callback();
            }
            else {
                callback();
            }
        });
    },
    'shopping': function(template, reply, callback) {
        var options = {
            apiKey: global.keys['shoppingApiKey'],
            trackingId: global.keys['shoppingTrackingId'],
            numItems: exports.provider['shopping'] || 0,
            showOffersOnly: 'true',
            numAttributes: 0,
            doSkipping: 'true',
            itemsSortType: 'relevance',
            itemsSortOrder: 'descending',
            productOffersSortType: 'relevance',
            productOffersSortOrder: 'descending'
        };
        if (global.categoriesMap['shopping'][template.categoryId] || !template.categoryId) {
            if (template.categoryId) options['categoryId'] = global.categoriesMap['shopping'][template.categoryId].id;
            var request = 'http://api.ebaycommercenetwork.com/publisher/3.0/json/GeneralSearch?visitorUserAgent&visitorIPAddress&keyword='+encodeURIComponent((template.term || ''));
            _.keys(options).map(function(k){ request=request+"&"+k+"="+options[k]; });
            var start = Date.now();
            http.get(request, function(res){
                var data = '';
                res.setEncoding('utf-8')
                res.on('data', function(chunk){
                    data += chunk
                });
                res.on('end', function(chunk){
                    data += (chunk || '');
                    console.log("shopping products call for term "+(template.term || '')+" returned  //elapsed "+(Date.now()-start));
                    var err=undefined;
                    if (!data) callback('Error has occured at shopzillaAPI.providers.shopping() - no data returned from request', []);
                    else {
                        try {
                            data = JSON.parse(data);
                        } catch(e) {
                            err=e;
                        }
                        if (!err) {
                            if (data.exceptions && data.exceptions.exception && data.exceptions.exception.length)
                                for (var i in data.exceptions.exception)
                                    if (data.exceptions.exception[i].type==="error") {
                                        err = data.exceptions.exception[i].message;
                                        break;
                                    }
                            if (err) callback(err);
                            else {
                                var items = [];
                                if (data.categories && data.categories.category && data.categories.category.length) {
                                    data.categories.category.map(function(category){
                                        if (category.items && category.items.item && category.items.item.length) {
                                            category.items.item.map(function(item){
                                                if (item.offer) items[items.length]=item.offer;
                                            });
                                        }
                                    });
                                }
                                var usedIds = {};
                                standardResults(items, usedIds, reply, unifiers['shopping']);
                                callback();
                            }
                        }
                        else callback("got error at shopping products:" + err);
                    }
                });
            });
        }
        else {
            //todo monitor it
            callback(null, []);
        }
    }
}

var unifiers = {
    'shopzilla': function(product){
        product.id = "sz." + product.id;
        var ret = {
            offerId: product.id,
            title : product.title || "",
            merchantName: product.merchantName || "",
            merchantLogoUrl: product.merchantLogoUrl || "",
            url: global.HOST + '/productUrl?offerId=' + product.id + '&url=' + encodeURIComponent(product.url.value), //the url goes to us, we will incr the monitoring and redirect to the right place
            price: product.price.value,
            integral : product.price.integral,
            description : product.description || "",
            provider : "shopzilla"
        };

        if (product.merchantRating && product.merchantRating.value != undefined){
            ret.rating = product.merchantRating.value/2;
        }

        if (product.images && product.images.image){
            var img;
            ret.images = [];
            for (var i = 0; i < product.images.image.length; i++){
                img = product.images.image[i];
                var valid=true;
                try {
                    check(img.value, "Skipped invalid url image").isUrl();
                } catch (e) {
                    valid =  false;
                }
                if (valid) ret.images.push({size : img.xsize, url : img.value});
            }
        }
        return ret;
    },
    'shopping': function(product) {
        product.id = "sp." + product.id;
        var ret = {
            offerId: product.id,
            title : product.name || "",
            merchantName: ((product.store) ? (product.store.name || "") : ""),
            merchantLogoUrl: ((product.store && product.store.logo) ? (product.store.logo.sourceURL || "") : ""),
            url: global.HOST + '/productUrl?offerId=' + product.id + '&url=' + encodeURIComponent(product.offerURL), //the url goes to us, we will incr the monitoring and redirect to the right place
            price: "$"+product.originalPrice.value,
            integral : Math.round(product.originalPrice.value*100),
            description : product.description || "",
            provider : "shopping"
        };

        if (product.store && product.store.ratingInfo && product.store.ratingInfo.rating)
            ret.rating = product.store.ratingInfo.rating;

        if (product.imageList && product.imageList.image){
            var img;
            ret.images = [];
            for (var i = 0; i < Math.min(product.imageList.image.length, 4); i++){
                img = product.imageList.image[i];
                var valid=true;
                try {
                    check(img.sourceURL, "Skipped invalid url image").isUrl();
                } catch (e) {
                    valid =  false;
                }
                if (valid) ret.images.push({size : img.width, url : img.sourceURL});
            }
        }
        return ret;
    }
}

var standardResults = function(items, usedIds, reply, unifier) {
    if (!items.length) return;
    if (!reply.mainImage) {
        if (items[0].imageList && items[0].imageList.image && items[0].imageList.image.length) reply.mainImage = items[0].imageList.image[items[0].imageList.image.length-1].sourceURL;
        else if (items[0].images && items[0].images.image && items[0].images.image.length) reply.mainImage = items[0].images.image[items[0].images.image.length-1].value;
    }
    items.map(function(item) {
        if (!usedIds[item.id]) {
            usedIds[item.id] = true;
            var unified = unifier(item);
            if (!reply.list[unified.integral]) reply.list[unified.integral]=[];
            reply.list[unified.integral][reply.list[unified.integral].length] = unified;
            reply.products[item.id] = unified;
            reply.count++;
        }
    });
}