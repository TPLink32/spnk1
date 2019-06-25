import controllers.module as module

import splunk, splunk.search, splunk.util, splunk.entity
import lib.util as util
import lib.i18n as i18n
import logging

logger = logging.getLogger('splunk.module.AristaShowTopology')

import math
import cgi
import os
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

MAX_MULTI_VALUE_COUNT = 50

class AristaShowTopology(module.ModuleHandler):
    
    def generateResults(self, host_app, client_app, sid, count=1000, offset=0, entity_name='results'):

        count = max(int(count), 0)
        offset = max(int(offset), 0)
        if not sid:
            raise Exception('AristaShowTopology.generateResults - sid not passed!')

        try:
            job = splunk.search.getJob(sid)
        except splunk.ResourceNotFound, e:
            logger.error('AristaShowTopology could not find the job %s. Exception: %s' % (sid, e))
            return _('<p class="resultStatusMessage">The job appears to have expired or has been canceled.</p>')

        offset_start = offset
        if offset < 0 and count < abs(offset):
            offset_start = -count
        
        dataset = getattr(job, entity_name)[offset_start: offset+count]

        pid = str(os.getpid())
        tmpfile = "topology_"+pid+".html"
        f = open(os.getenv("SPLUNK_HOME")+"/etc/apps/aristanetworks/appserver/static/"+tmpfile, 'w')
        f.write("<!DOCTYPE html>\n")
        f.write("<meta charset='utf-8'>\n")
#        f.write("<script src='d3.v2.js' charset='utf-8'></script>\n")
        f.write("<script src='http://d3js.org/d3.v2.js?2.9.1' charset='utf-8'></script>\n")
        f.write("<style>\n")
        f.write(".link { fill: none; stroke: #003468; stroke-width: 1.5px; }\n")
        f.write(".node circle { fill: #003468; stroke: #fff; stroke-width: 1.5px; }\n")
        f.write("text { font: 9px sans-serif; }\n")
        f.write("</style>\n")
        f.write("</head><body><html><script>")
        f.write("var topology = [")
 
        for i, result in enumerate(dataset):
           src = str(result.get('src', None))
           dst = str(result.get('dst', None))
           if (i > 0):
              f.write(",")

           f.write("\n  {source: '"+src.split(':')[0]+"', target: '"+dst.split(':')[0]+"'}")

        f.write("];\n")
        f.write("var nodes = {};\n")
        f.write("\n")
        f.write("  // Compute the distinct nodes from the links.\n")
        f.write("  topology.forEach(function(link) {\n")
        f.write("    link.source = nodes[link.source] || (nodes[link.source] = {name: link.source});\n")
        f.write("    link.target = nodes[link.target] || (nodes[link.target] = {name: link.target});\n")
        f.write("  });\n")
        f.write("\n")
        f.write("  var width = 600,\n")
        f.write("      height = 650;\n")
        f.write("\n")
        f.write("  var force = d3.layout.force()\n")
        f.write("    .nodes(d3.values(nodes))\n")
        f.write("    .links(topology)\n")
        f.write("    .size([1024, height])\n")
        f.write("    .linkDistance(200)\n")
        f.write("    .charge(-600)\n")
        f.write("    .on('tick', topologytick)\n")
        f.write("    .start();\n")
        f.write("\n")
        f.write("  var svg = d3.select('body').append('svg')\n")
        f.write("    .attr('width', '100%')\n")
        f.write("    .attr('height', '650')\n")
        f.write("\n")
        f.write("  var link = svg.selectAll('.link')\n")
        f.write("    .data(force.links())\n")
        f.write("    .enter().append('line')\n")
        f.write("    .attr('class', 'link');\n")
        f.write("\n")
        f.write("  var node = svg.selectAll('.node')\n")
        f.write("    .data(force.nodes())\n")
        f.write("    .enter().append('g')\n")
        f.write("    .attr('class', 'node')\n")
        f.write("    .on('mouseover', topologymouseover)\n")
        f.write("    .on('mouseout', topologymouseout)\n")
#        f.write("    .on('click', topologyclick)\n")
        f.write("    .call(force.drag);\n")
        f.write("\n")
        f.write("  node.append('circle')\n")
        f.write("    .attr('r', 8);\n")
        f.write("\n")
        f.write("  node.append('text')\n")
        f.write("    .attr('x', 12)\n")
        f.write("    .attr('dy', '.35em')\n")
        f.write("    .text(function(d) { return d.name; });\n")
        f.write("\n")
        f.write("function topologytick() {\n")
        f.write("  link\n")
        f.write("      .attr('x1', function(d) { return d.source.x; })\n")
        f.write("      .attr('y1', function(d) { return d.source.y; })\n")
        f.write("      .attr('x2', function(d) { return d.target.x; })\n")
        f.write("      .attr('y2', function(d) { return d.target.y; });\n")
        f.write("\n")
        f.write("  node\n")
        f.write("      .attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });\n")
        f.write("}\n")
        f.write("\n")
        f.write("function topologymouseover() {\n")
        f.write("  d3.select(this).select('circle').transition()\n")
        f.write("      .duration(750)\n")
        f.write("      .attr('r', 20);\n")
        f.write("  d3.select(this).select('text').transition()\n")
        f.write("      .duration(750)\n")
        f.write("      .attr('fill', '#003468')\n")
        f.write("      .attr('x', 20);\n")
        f.write("}\n")
        f.write("\n")
        f.write("function topologymouseout() {\n")
        f.write("  d3.select(this).select('circle').transition()\n")
        f.write("      .duration(750)\n")
        f.write("      .attr('r', 8);\n")
        f.write("  d3.select(this).select('text').transition()\n")
        f.write("      .duration(750)\n")
        f.write("      .attr('fill', '#000000')\n")
        f.write("      .attr('x', 12);\n")
        f.write("}\n")
        f.write("\n")
        f.write("function topologyclick(d) {\n")
        f.write("  alert(d.name);\n")
        f.write("}\n")
        f.write("</script>\n")
        f.write("</body>\n")
        f.write("</html>\n")

        f.close()

        output = []
        output.append('<iframe src=\'../../static/app/aristanetworks/%s\' id=\'topologyframe\' width=100%% height=800></iframe>' % (tmpfile))
#        output.append('<iframe src=\'../../static/app/aristanetworks/topology_9716.html\' id=\'topologyframe\' width=100%% height=800></iframe>' )

        output.append('<div class="AristaShowTopologyWrapper">')
        output.append('<script>showTopology();</script>\n')
        output.append('</div">')
 
        if (entity_name == 'results' and job.resultCount == 0):
            if job.isDone:
                output = self.generateStatusMessage(entity_name, 'nodata', job.id)
            else:
                output = self.generateStatusMessage(entity_name, 'waiting', job.id)
        else:
            output = ''.join(output)

        return output
