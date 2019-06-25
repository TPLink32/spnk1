Splunk.Module.AristaShowTopology = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.myParam = this.getParam("myParam");
        this.resultsContainer = this.container;
    },

    onJobDone: function(event) {
        this.getResults();
    },

    getResultParams: function($super) {
        var params = $super();
        var context = this.getContext();
        var search  = context.get("search");
        var sid         = search.job.getSearchId();

        if (!sid) this.logger.error(this.moduleType, "Search ID is missing.");

        params.sid = sid;
        return params;
    },

    renderResults: function($super, htmlFragment) {
        if (!htmlFragment) {
            this.resultsContainer.html('No content available.');
            return;
        }
        this.resultsContainer.html(htmlFragment);
    }
});


// ltd below
function autoResize(id){
    var newheight;
    var newwidth;

    if(document.getElementById){
        newheight=document.getElementById(id).contentWindow.document .body.scrollHeight;
        newwidth=document.getElementById(id).contentWindow.document .body.scrollWidth;
    }

    document.getElementById(id).height= (newheight) + "px";
    document.getElementById(id).width= (newwidth) + "px";
}
