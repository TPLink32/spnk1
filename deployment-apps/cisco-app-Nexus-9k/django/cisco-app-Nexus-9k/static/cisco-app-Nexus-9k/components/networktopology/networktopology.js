function isDuplicateLink(record, set) {
    var sourceName = record[0];
    var targetName = record[1];
    var sourceInt = record[2];
    var targetInt = record[3];
    
    var sourceNameParts = sourceName.split('.');
    var targetNameParts = targetName.split('.');
    
    var uniqueKey = null;
    
    if(sourceNameParts[3] > targetNameParts[3]) {
        uniqueKey = targetName + sourceName + targetInt + sourceInt;
    } else {
        uniqueKey = sourceName + targetName + sourceInt + targetInt;
    }
    
    if(typeof(set[uniqueKey]) != "undefined") {
        return true;
    } else {
        set[uniqueKey] = true;
        return false;
    }
}
jQuery(document).ready(function(){
   $("#force-directed").mousemove(function(e){
      var parentOffset = $(this).parent().offset(); 
      window.mouseXPos = e.pageX - parentOffset.left;
      window.mouseYPos = e.pageY - parentOffset.top;
   }); 
});
var tmpTooltipContent = null;
define(function(require, exports, module) {

    var _ = require('underscore');
    var d3 = require("../d3/d3");
    var qTip = require("../powertip/jquery.powertip.min");
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");

    require("css!./networktopology.css");
    require("css!./../powertip/jquery.powertip-light.min.css");

    var ForceDirected = SimpleSplunkView.extend({
        moduleId: module.id,

        className: "splunk-toolkit-force-directed",

        options: {
            managerid: null,   
            data: 'preview',  
            panAndZoom: true,
            directional: true,
            valueField: 'count',
            charge: -100,
            gravity: .05,
            linkDistance: 182,
            swoop: false,
            isStatic: false
        },

        output_mode: "json_rows",

        initialize: function() {
			console.log("inside initialize");
            SimpleSplunkView.prototype.initialize.apply(this, arguments);
            console.log("inside initialize1");
            // in the case that any options are changed, it will dynamically update
            // without having to refresh.
            this.settings.on("change:charge", this.render, this);
            this.settings.on("change:gravity", this.render, this);
            this.settings.on("change:linkDistance", this.render, this);
            this.settings.on("change:directional", this.render, this);
            this.settings.on("change:panAndZoom", this.render, this);
            this.settings.on("change:swoop", this.render, this);
            this.settings.on("change:isStatic", this.render, this);
            console.log("inside initialize2");
        },

        createView: function() {
		console.log("inside createView");
            var margin = {top: 10, right: 10, bottom: 10, left: 10};
            var availableWidth = parseInt(this.settings.get("width") || this.$el.width());
            var availableHeight = parseInt(this.settings.get("height") || this.$el.height());

            this.$el.html("");

            var svg = d3.select(this.el)
                .append("svg")
                .attr("width", availableWidth)
                .attr("height", availableHeight)
                .attr("pointer-events", "all")

            return { container: this.$el, svg: svg, margin: margin };
        },

        // making the data look how we want it to for updateView to do its job
        formatData: function(data) { 
		console.log("inside formatData");
            names = []
            groupNames = {}
            groupCount = 0
            output = {'nodes': [], 'links': []};
            
            var grouplookup = [];
            var groupFlag = false;

            var nodes = {};
            var links = [];
	   // var detectDuplicateEntry = new Set();
	    var set = {};
            data.forEach(function(link) {                 
                console.log('LINK: ', link);
		var sourceName = link[0];
                var targetName = link[1];
                var src_int= link[2];
                var dest_int = link[3];
                var group= link[4];
                var hostname = link[5]
                var hostnamedest = link[6]
		var newLink = {};

                newLink.source = nodes[sourceName] || 
                    (nodes[sourceName] = {name: sourceName, group: group, value: 0, hostname: hostname});
                newLink.target = nodes[targetName] || 
                    (nodes[targetName] = {name: targetName, group: group, value: 0, hostname: hostnamedest});
                newLink.sourceGroup = link[2];
                newLink.targetGroup= link[3];
                newLink.value = link[7];
                newLink.source.value = newLink.value;
                newLink.target.value = newLink.value;
		if(isDuplicateLink(link, set) == false) {
			links.push(newLink);
		}
console.log('this', this);
		//links.push(newLink);
            });

	console.log('Post Processing LINK: ', links);
            return {nodes: d3.values(nodes), links: links};
        },

        updateView: function(viz, data){
		console.log("inside updateView");
            var that = this;
            var containerHeight = this.$el.height();
            var containerWidth = this.$el.width();

            // Clear svg
            var svg = $(viz.svg[0]);
            svg.empty();
            svg.height(containerHeight);
            svg.width(containerWidth);

            // Add the graph group as a child of the main svg
            var graphWidth = containerWidth - viz.margin.left - viz.margin.right
            var graphHeight = containerHeight - viz.margin.top - viz.margin.bottom;
            var graph = viz.svg
                .append("g")
                .attr("width", graphWidth)
                .attr("height", graphHeight)
                .attr("transform", "translate(" + viz.margin.left + "," + viz.margin.top + ")");

            // Get settings
            this.charge = this.settings.get('charge');
            this.gravity = this.settings.get('gravity');
            this.linkDistance = this.settings.get('linkDistance');
            this.zoomable = this.settings.get('panAndZoom');
            this.swoop = this.settings.get('swoop');
            this.isStatic = this.settings.get('isStatic');
            this.isDirectional = this.settings.get('directional');
            this.zoomFactor = 0.5;
      
            this.groupNameLookup = data.groupLookup;            


            this.color = d3.scale.category20();

            // Set up graph

            var r = 10;
            var force = d3.layout.force()
              .nodes(data.nodes)
              .links(data.links)
              .gravity(this.gravity)
              .distance(this.linkDistance)
              .charge(this.charge)
              .size([graphWidth, graphHeight])
              .start();

            var link = graph.selectAll("line.link")
              .data(data.links)
              .enter().append("svg:line")
              .attr("class","link")
              .attr("x1", function(d) { return d.source.x; })
              .attr("y1", function(d) { return d.source.y; })
              .attr("x2", function(d) { return d.target.x; })
              .attr("y2", function(d) { return d.target.y; });


              link
                .on('click', function(d) {
                    that.trigger('click:link', {
                        source: d.source.name,
                        sourceGroup: d.sourceGroup,
                        target: d.target.name,
                        targetGroup: d.targetGroup,
                        value: d.value 
                    });
                })
                .on('mouseover', function(d) {
                    //d3.select(this).classed('linkHighlight', true);
                    composeLinkToolTip(d); 
                });
                // .on('mouseout', function(d) {
                //     d3.select(this).classed('linkHighlight', false);
                // });
                
                $(".link").data("powertip", getTooltip);
                $(".link").powerTip({mouseOnToPopup: true, followMouse: true});

            var node_drag = d3.behavior.drag()
                .on("dragstart", function(d, i) {
                  force.stop();
                })
                .on("drag", function(d, i) {
                  d.px += d3.event.dx;
                  d.py += d3.event.dy;
                  d.x += d3.event.dx;
                  d.y += d3.event.dy
;                  tick();
                })
                .on("dragend", function(d, i) {
                  d.fixed = true;
                  tick();
                  force.resume();
                });

                var node = graph.selectAll("g.node")
                  .data(data.nodes)
                  .enter().append("svg:g")
                  .attr("class","node")
                  .call(node_drag);

                node.append("svg:circle")
                  .attr("class", "circle")
                  .attr("r", r-1)
                  .style("fill","#458B00")
                  .call(node_drag);

                node.append("svg:text")
                    .attr("class", "nodetext")
                    .attr("dx", 12)
                    .attr("dy", ".35em")
                    .text(function(d) { return d.hostname });

                node
                .on('click', function(d) { 
                    that.trigger('click:node', {
                        name: d.name,
                        group: d.group,
                        value: d.value, 
                        hostname: d.hostname
                    });
                })
                .on('mouseover', function(d) {
                    //d3.select(this).classed('linkHighlight', true);   
                    composeNodeToolTip(d); 
                });
                // .on('mouseout', function(d) {
                //     d3.select(this).classed('linkHighlight', false);  
                // });
                
                $(".circle").data("powertip", getTooltip);
                $(".circle").powerTip({mouseOnToPopup: true});

                force.on("tick", tick);

            var tick = function() {
                console.log("indisde tick");
            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

                node.attr("transform", function(d, node) {node.x = d.x; node.y = d.y; return "translate(" + d.x + "," + d.y + ")"; } );

          };
            
          force.nodes(data.nodes)
                .links(data.links)
                    .on("tick", tick).start();

			

            function forwardAlpha(layout, alpha, max) {
			console.log("inside forwardAlpha");
                alpha = alpha || 0;
                max = max || 1000;
                var i = 0;
                while(layout.alpha() > alpha && i++ < max) layout.tick();
            }

            // draggin'
            function initPanZoom(svg){
			console.log("inside initPanZoom");
                var that = this;
                svg.on('mousedown.drag', function(){
                    if(that.zoomable)
                        svg.classed('panCursor', true);
                    // console.log('drag start');
                });

                svg.on('mouseup.drag', function(){
                    svg.classed('panCursor', false);
                    // console.log('drag stop');
                });

                svg.call(d3.behavior.zoom().on("zoom", function() { 
                    panZoom();
                }));
            }

            // zoomin'
            function panZoom() {
			console.log("inside panZoom");
                graph.attr("transform",
                    "translate(" + d3.event.translate + ")"
                    + " scale(" + d3.event.scale + ")");        
            }
			function composeNodeToolTip(d) {
				tmpTooltipContent = d.name;
			}
			function getTooltip() {
				var tip = tmpTooltipContent;
                tmpTooltipContent = null;
                return tip;
			}
			function composeLinkToolTip(d) {
				var html = "<div>";
				html += "Source: " + d.source.name + "</br>";
				html += "Source Interface: " + d.sourceGroup + "</br>";
				html += "Destination: " + d.target.name + "</br>";
				html += "Destination Interface: " + d.targetGroup + "</br>";
                html += "</div>"
				tmpTooltipContent = html;
			}

            //TODO: This doesn't seem to be used in this file
            function getSafeVal(getobj, name) {
			console.log("inside getSafeVal");
                var retVal; 
                if (getobj.hasOwnProperty(name) && getobj[name] !== null) {
                    retVal = getobj[name];
                } else {
                    retVal = name; 
                }
                return retVal;
            }

   //          function highlightNodes(val) {
			// console.log("inside highlightNodes");
   //              var self = this, groupName;
   //              if(val !== ' ' && val !== ''){
   //                  graph.selectAll('circle')
   //                      .filter(function (d, i) {
   //                          groupName = self.groupNameLookup[d.group];
   //                          if(d.source.indexOf(val) >= 0 || groupName.indexOf(val) >= 0){
   //                              d3.select(this).classed('highlight', true);
   //                          } else {
   //                              d3.select(this).classed('highlight', false);
   //                          }
   //                      });
   //              } else {
   //                  graph.selectAll('circle').classed('highlight', false);
   //              }
   //          }



            /////////////////////// formerly known as tooltips.js /////////////////////////////
        }

    });
    return ForceDirected;
});
