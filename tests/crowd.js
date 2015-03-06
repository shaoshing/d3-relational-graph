
'use strict';

var data = generateRandomData(200, 200, ['blue', 'red', 'yellow'], [20]);
var graph = new D3RGraph('#graph svg', data, {
  zoomMinScale: 0.4,
  zoomInitialScale: 0.4
});
graph.on(D3RGraph.Events.BEFORE_LOAD, function(graph){
  graph.force.linkDistance(25);
});
graph.draw();

function generateRandomData(nodesN, linksN, colors, radius) {
  var data = { nodes: [], links: [] };

  for(var i = 0; i < nodesN; i++){
    data.nodes.push({
      'title': chance.name(),
      'styles': {
        'circleFill': chance.pick(colors),
        'circleR': chance.pick(radius)
      }
    });
  }

  for(i = 0; i < linksN; i++){
    data.links.push({
      'source': chance.integer({min: Math.round(data.nodes.length/2), max: data.nodes.length-1}),
      'target': chance.integer({min: 0, max: Math.round(data.nodes.length/2)-1})
    });
  }

  return data;
}

function showNearbyNodes(id) {
  var node = graph.getItem(id);
  console.log('node', node.textBox);
  for(var i = 0; i < node.nearbyNodes.length; i++){
    var n = node.nearbyNodes[i];
    $('#'+n.circleId).attr('stroke', 'black');
    console.log(n.title, n.nodeBox);
  }
}
