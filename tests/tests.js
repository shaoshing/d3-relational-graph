/*jslint latedef:false */
/*global D3RGraph: true */
/*global test:true, ok:true, equal:true, notEqual:true */

'use strict';

var data1 = {
  styles: {
    backgroundFill: 'gray'
  },
  nodes: [{
    title: null,
    styles: {
      circleR: 20,
      circleFill: 'red',
      labelFontSize: '15',

      circleHighlightedScale: 2,
      circleHighlightedStroke: 'blue',
      circleHighlightedStrokeWidth: 1.2,


    }
  }, {
    title: 'has title',
    id: 'has-id'
  }],
  links: [{
    source: 0,
    target: 1,
    styles: {
      lineStroke: 'black',
      lineStrokeWidth: 4
    }
  }]
};

var data2 = {
  nodes: [{
    title: null
  }, {
    title: 'has title',
    id: 'has-id'
  }, {
    title: 'I am alone'
  }],
  links: [{
    source: 0, target: 1
  }]
};

var graph1 = new D3RGraph('#graph-1', data1, {
  progressiveLoading: true
});
graph1.on(D3RGraph.Events.DREW, runTests);
var graph2 = new D3RGraph('#graph-2', data2);
graph2.on(D3RGraph.Events.DREW, runTests);


var firedEvents = {};
graph1.on(D3RGraph.Events.BEFORE_LOAD, function(graph){firedEvents.beforeLoad = {graph: graph};});
graph1.on(D3RGraph.Events.LOADING, function(graph, progress){firedEvents.loading = {graph:graph, progress:progress};});
graph1.on(D3RGraph.Events.LOADED, function(graph){firedEvents.loaded = {graph: graph};});
graph1.on(D3RGraph.Events.DREW, function(graph){firedEvents.drew = {graph: graph};});
graph1.on(D3RGraph.Events.ZOOMED, function(graph){firedEvents.zoomed = {graph: graph};});
graph1.on(D3RGraph.Events.NODE_CLICK, function(graph, node){firedEvents.nodeClick = {graph: graph, node:node};});


// https://stackoverflow.com/questions/9063383/how-to-invoke-click-event-programmaticaly-in-d3
jQuery.fn.d3Click = function () {
  this.each(function (i, e) {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent('mousedown', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    e.dispatchEvent(evt);

    evt = document.createEvent("MouseEvents");
    evt.initMouseEvent('mouseup', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    e.dispatchEvent(evt);
  });
};

var runCount = 0;
function runTests() {
  runCount++;
  if(runCount !== 2) return;

  test('data set', function() {
    ok(data1.nodes[0].id, 'should assign id if has none');
    equal(data1.nodes[1].id, 'g0-has-id', 'should keep original id with prefix');
    notEqual(data1.nodes[0].id, data1.nodes[1].id);

    ok(data2.nodes[0].id, 'should assign id if has none');
    equal(data2.nodes[1].id, 'g1-has-id', 'id prefix should be different between graphs');
    notEqual(data1.nodes[0].id, data2.nodes[0].id, 'ids should be unique between graphs');

    ok(data1.nodes[1].title, 'should assign title if has none');
  });

  test('events', function() {
    ok(firedEvents.beforeLoad, 'should fire BEFORE_LOAD');
    ok(firedEvents.loading, 'should fire LOADING');
    ok(firedEvents.loaded, 'should fire LOADED');
    ok(firedEvents.drew, 'should fire DREW');

    firedEvents.zoomed = null;
    graph1.zoom(0.6);
    ok(firedEvents.zoomed, 'should fire ZOOMED');

    firedEvents.nodeClick = null;
    $('#'+data1.nodes[1].groupId).d3Click();
    ok(firedEvents.nodeClick, 'should fire NODE_CLICK');
    equal(firedEvents.nodeClick.node, data1.nodes[1], 'should pass in clicked node');
  });

  test('styles', function(assert){
    equal($('#graph-1 .background').attr('fill'), 'gray', 'should use custom background color');

    var circle = $('#'+data1.nodes[0].groupId+' circle');
    equal(circle.attr('fill'), 'red');
    equal(circle.attr('r'), '20');

    var text = $('#'+data1.nodes[0].groupId+' text');
    equal(text.attr('font-size'), '15px');

    var line = $('#'+data1.links[0].lineId);
    equal(line.attr('stroke'), 'black');
    equal(line.attr('stroke-width'), '4');


    $('#'+data1.nodes[0].groupId).d3Click();
    console.log('click');

    var done = assert.async();
    setTimeout(function(){
      console.log('timeout');
      equal(circle.attr('stroke'), 'blue');
      equal(circle.attr('stroke-width'), '1.2');
      done();
    }, 700); // wait until annimation is over
  });

  test('centering', function(assert){
    var prePosition = graph2.zoomBehavior.translate();
    var done = assert.async();
    $('#'+data2.nodes[0].groupId).d3Click();
    setTimeout(function(){
      var curPosition = graph2.zoomBehavior.translate();
      notEqual(prePosition, curPosition);
      done();
    }, 700); // wait until annimation is over
  });

  test('highlighting and relations', function(assert){
    var done = assert.async();
    $('#'+data2.nodes[1].groupId).d3Click();
    setTimeout(function(){
      ok($('#'+data2.nodes[0].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data2.nodes[1].groupId).attr('class').indexOf('highlighted-node center') !== -1);
      ok($('#'+data2.nodes[2].groupId).attr('class').indexOf('highlighted-node') === -1);

      var relations = graph2.getRelations(data2.nodes[1].id);
      equal(relations.nodes.length, 1);
      equal(relations.links.length, 1);
      equal(relations.nodeIds.length, 1);
      equal(relations.lineIds.length, 1);
      equal(relations.nodes[0], data2.nodes[0]);

      relations = graph2.getRelations(data2.nodes[2].id);
      ok(!relations, 'the 3rd node does not have any relations');

      done();
    }, 700); // wait until annimation is over
  });

}

graph1.draw();
graph2.draw();
