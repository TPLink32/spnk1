define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Vocabulary",
    "app-js/models/Term",
    "app-js/collections/Terms"
], function(
    $,
    _,
    Backbone,
    Vocabulary,
    Term,
    Terms
    ) {
    return Backbone.Collection.extend({

        model: Vocabulary,

        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "vocabularies"
        ].join('/')),

        //this URL returns XML instead of JSON
        fetch: function (options) {
            options = options || {};
            options.dataType = "xml";
            return Backbone.Collection.prototype.fetch.call(this, options);
        },

        parse: function (xml) {

            var termTypeInfo = Terms.termTypeInfo;
            var vocabs  = {};

            $.each($(xml).find("Term"), function(i, item) {

                var termId  = $(item).attr("id");
                var vocabId = termId.substring(0, termId.indexOf("."));
                var type    = $(item).find("Type").first().text();
                var comment = $(item).find("Comment").first().text();

                if (!vocabs[vocabId]) {
                    vocabs[vocabId] = {id: vocabId, name: termId, terms: []};
                }

                var term = new Term({
                    id       : termId,
                    name     : termId.replace(vocabId + '.', ''),
                    type     : type,
                    category : termTypeInfo[type].category,
                    comment  : comment
                });

                vocabs[vocabId].terms.push(term);

            });

            return _.values(vocabs);

        }
    });
});