var async = require('async'),
    http = require('http'),
    _ = require('underscore');

var options = {
    apiKey: '6c7b8b0d-3791-4db1-a8d6-c797890f1294',
    trackingId: '8070536',
    numItems: 5000,
    showAllMatchingCategories: 'true'
};

function addItems(list, array) {
    for (var index in array) {
        if (array[index].children) addItems(list, array[index].children.category);
        if (array[index].name && array[index].id) list[array[index].name]=array[index].id;
    }
};

var runner = function() {
    var result = {};
    require('./shopzillaAPI.js')({}).getCategoriesTree(100000, function(err, tree){
        var list = [];
        if (err) {
            console.log(err);
        } else {
            var categoryTree = tree.taxonomy.categories.category[0].children.category;
            addItems(list, categoryTree);
            console.log('found: '+ _.keys(list).length);

            async.map(_.keys(list), function(cat, cb){
                var request = 'http://api.ebaycommercenetwork.com/publisher/3.0/json/GeneralSearch?visitorUserAgent&visitorIPAddress&keyword='+encodeURIComponent(cat);
                _.keys(options).map(function(k){ request=request+"&"+k+"="+options[k]; });

                http.get(request, function(res){
                    var data = '';
                    res.setEncoding('utf-8')
                    res.on('data', function(chunk){
                        data += chunk
                    });
                    res.on('error', function(err) {
                        cb(err);
                    });
                    res.on('end', function(){
                        if (!data) cb(null, []);
                        else {
                            try {
                                data = JSON.parse(data).categories.category[0];
                                result[list[cat]]={name:cat, shoppingName: data.name, id: data.id};
                                cb(null, data);
                            } catch(e) { cb(e); }
                        }
                    });
                });
            }, function(err, replies){
                if (err) console.log(err);
                console.log("done: "+ _.keys(result).length);
                console.log(result);
            });
        }
    });
}

runner();