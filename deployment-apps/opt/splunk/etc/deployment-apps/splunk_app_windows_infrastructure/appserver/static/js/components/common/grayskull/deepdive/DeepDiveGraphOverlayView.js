define([
    'jquery',
    'underscore',
    'backbone',
    'app-contrib/d3/d3.amd',
    'app-components/deepdive/DeepDiveUtils'
], function(
    $, 
    _, 
    Backbone,
    d3,
    deepDiveUtils) {

    function graphDataTransform(timePosition, graphData) {
        return {
            yExtent: graphData.view.yScale.domain(),
            yInfo: graphData.view.getYInfoForTimePosition(timePosition),
            dims: graphData.view.lastKnownBodyDims()
        };
    }

    function keyEventDataTransform(timePosition, graphData) {
        return {
            xInfo: graphData.view.getXZoneForTimePosition(timePosition),
            dims: graphData.view.lastKnownBodyDims()
        };
    }

    function overlayGraphHandler(rawGraphData, coordinates, svgElement) {
        
        var topOffset = 40;

        function graphRenderer(rawGraphData) {

            var graphData = _.map(rawGraphData, _.partial(graphDataTransform, [coordinates[0]]));

            var graphInspections = svgElement.selectAll("g.lane-investigator-graph-label")
                    .data(graphData, function(d) { return coordinates[0] + "%" + d.dims.top; });

            // Take new graph objects entered into the record and
            // generate visible components for them.
            graphInspections.enter().append('g').each(function(g) {
                var group = d3.select(this);

                group.append('rect')
                    .attr("class", "lane-investigator-the-line")
                    .attr("opacity", 1)
                    .attr("x", 0)
                    .attr("width", 1)
                    .attr("y", 0)
                    .attr("height", g.dims.height)
                    .attr("fill", '#d3d3d3');

                group.append('text')
                    .attr("class", "lane-investigator-graph-marker-label")
                    .attr("font-family", "Roboto, Droid, 'Helvetica Neue', Helvetica, Arial, sans-serif;")
                    .attr("font-size", "18px")
                    .attr('font-weight', 'bold')
                    .attr('fill', '#444444')
                    .attr('text-anchor', 'start')
                    .attr('y', 17)
                    .attr('x', 8);

                group.attr("class", "lane-investigator-graph-label")
                    .attr('opacity', '1e-6')
                    .attr("transform", 'translate(' + coordinates[0] + ', ' + (g.dims.top + topOffset) + ')');
            });

            // Take objects "exited" from the record and remove their
            // visible components, including all their children.
            graphInspections.exit().remove();

            // Mark any range axis objects to be hidden.
            svgElement.select('.lane-investigator-range-axis').attr('opacity', '1e-6');
            svgElement.select('.lane-investigator-circle').attr('opacity', '1e-6');

            graphInspections.each(function(g) {
                var group = d3.select(this);

                if ((coordinates[0] < 1) || (coordinates[0] > g.dims.width) || (g.dims.height < 15)) {
                    group.attr('opacity', '1e-6');
                    return;
                }

                group.attr('opacity', "1")
                    .attr("height", g.dims.height)
                    .attr("transform", 'translate(' + (coordinates[0] - 1) + ', ' + (g.dims.top + topOffset) + ')');

                // This is relative to the transformation box, so it
                // doesn't need to be tranformed.
                group.select('.lane-investigator-graph-dot')
                    .attr("cx", 1)
                    .attr("cy", g.yInfo.yPosition);

                var text = group.select('.lane-investigator-graph-marker-label');
                text.text(String(deepDiveUtils.roundNumber(g.yInfo.yValue)));
                var labelSize = text.node().getBBox().width + 11;         
                text.transition()
                    .attr("transform", "translate(" + ((labelSize + coordinates[0]) < g.dims.width ? 1 : -1 * labelSize) + ", 17)");
                
                // The range markers are already present, they just
                // need to be positioned correctly and then unmasked.
                if ((coordinates[1] >= g.dims.top + topOffset) && (coordinates[1] < (g.dims.top + topOffset + g.dims.height))) {
                    svgElement.selectAll("text.lane-investigator-range-axis-min").text(g.yExtent[0]);
                    svgElement.selectAll("text.lane-investigator-range-axis-max").text(g.yExtent[1]);
                    svgElement.select('.lane-investigator-range-axis')
                        .attr('transform', "translate(" + (coordinates[0] - 1) + ',' + (g.dims.top + topOffset) + ')')
                        .attr('opacity', '1');
                    svgElement.select('.lane-investigator-circle')
                        .attr('transform', "translate(" + (coordinates[0] - 1) + ',' + (g.dims.top + topOffset + g.yInfo.yPosition) + ')')
                        .attr('opacity', '1');
                }
            });
        }

        function keyEventRenderer(rawGraphData) {
            if (rawGraphData.length === 0) {
                return;
            }

            // Data is sparse in key events; filter out "no events" blocks.
            var graphData = _.filter(_.map(rawGraphData, _.partial(keyEventDataTransform, [coordinates[0]])),
                                     function(m) { return m.xInfo.pos !== null; });

            var keyevents = svgElement.selectAll("g.lane-investigator-key-event-highlight")
                    .data(graphData, function(d) { return coordinates[0] + "%" + d.dims.top; });

            keyevents.enter().append('g').each(function(g) {
                var group = d3.select(this);

                group.attr("class", "lane-investigator-key-event-highlight")
                    .attr("opacity", "1e-6");
                
                group.append('rect')
                    .attr("opacity", 1)
                    .attr("x", 3)
                    .attr("y", 8)
                    .attr("height", g.dims.height - 16)
                    .attr("width", g.xInfo.width - 6)
                    .attr("fill-opacity", 0)
                    .attr("stroke", 'yellow')
                    .attr("stroke-width", "2");

                group.on('mousedown', function(object) { 
                    d3.event.stopPropagation();
                });

                group.on('click', function(object) { 
                    d3.event.stopPropagation();
                    $('#deepdive-component-event-focus')
                        .data('events', [object.xInfo.time, object.xInfo.span])
                        .trigger('update', [object.xInfo.time, object.xInfo.span]);
                });
            });

            keyevents.exit().remove();

            keyevents.each(function(g) {
                var group = d3.select(this);

                if ((coordinates[0] < 1) || (coordinates[0] > g.dims.width) || (g.dims.height < 15)){
                    group.attr('opacity', '1e-6');
                    return;
                }

                group.attr('opacity', '1')
                    .attr("transform", 'translate(' + g.xInfo.pos + ', ' + (g.dims.top + topOffset) + ')');
            });
        }
                
        var graphGraphData = _.filter(
            rawGraphData, 
            function(g) { 
                var dtype = g.settings.get('overlayType') || g.settings.get('graphType');
                return _.contains(['dot', 'line', 'area', 'column'], dtype); 
            });


        var keyGraphData = _.filter(
            rawGraphData,
            function(g){ 
                var dtype = g.settings.get('overlayType') || g.settings.get('graphType');
                return dtype === 'event';
            });

        graphRenderer(graphGraphData);

        keyEventRenderer(keyGraphData);
    }

    return overlayGraphHandler;
});
