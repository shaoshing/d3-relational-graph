/*jslint latedef:false */
/*global chance:false, D3RGraph:false, Handlebars:false  */

'use strict';


document.addEventListener('DOMContentLoaded', function() {
  var data = generateRandomData(30, 50, ['blue', 'red', 'yellow', 'black', 'green'], [15, 17, 19, 21]);
  var basicGraph = new D3RGraph('.example-basic svg', data, {zoomInitialScale: 0.8});
  basicGraph.draw();

  var rows = [];
  var rowN = 5;
  for(var i = 0; i < data.nodes.length; i = i+rowN){
    rows.push({cells: data.nodes.slice(i, i+rowN)});
  }
  $('.example-basic table').html(render('#tbody-template', {rows: rows}));
  $('.example-basic table td').hover(function(){
    basicGraph.centerNode($(this).data('node-id'));
    basicGraph.highlightNode($(this).data('node-id'));
  });
});

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

function render(templateId, data) {
  var source = $(templateId).html();
  var template = Handlebars.compile(source);
  var html = template(data);
  return html;
}
