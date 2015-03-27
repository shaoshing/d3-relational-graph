/*jslint latedef:false */
/*global D3RGraph: true */
/*global test:true, ok:true, equal:true, notEqual:true, Q:true */

'use strict';

var data1 = {
  styles: {
    backgroundFill: 'gray',

    circleR: 20,
    circleFill: 'red',
    labelFontSize: '15',

    circleHighlightedScale: 1.5,
    circleHighlightedFill: 'blue',
    circleHighlightedStroke: 'black',
    circleHighlightedStrokeWidth: 1.2,

    circleCenterScale: 2,
    circleCenterFill: 'yellow',
    circleCenterStroke: 'gray',
    circleCenterStrokeWidth: 1.5,

    lineHighlightedStroke: 'blue',
    lineCenterStroke: 'blue',
  },
  nodes: [{
    title: null,
    styles: {
      circleFill: 'green'
    }
  }, {
    title: 'has title',
    id: 'has-id',
    styles: {
      circleFill: 'purple',
    }
  }, {
    title: '3rd circle',
    id: 'has-id-2'
  }, {
    title: '4th circle',
    id: 'has-id-3'
  }],
  links: [{
    source: 0,
    target: 1,
    styles: {
      lineStroke: 'black',
      lineStrokeWidth: 4,

      lineHighlightedStroke: 'yellow',
      lineHighlightedStrokeWidth: 6,

      lineCenterStroke: 'yellow',
      lineCenterStrokeWidth: 6,
    }
  },{
    source: 0,
    target: 3,
    styles: {
      lineHighlightedStrokeWidth: 5,
      lineCenterStrokeWidth: 5,
    }
  }]
};

var data2 = {
  nodes: [{
    title: null,
    filter: ['a', 'e']
  }, {
    title: 'has title',
    id: 'has-id',
    filter: 'b'
  }, {
    title: '3rd note',
    filter: 'a'
  }, {
    title: '4th node',
    filter: 'c'
  }],
  links: [
    {
      source: 0,
      target: 1
    },{
      source: 0,
      target: 2,
      styles: {
        lineStrokeWidth: 5,
        lineStrokeDasharray: '5,5',
        lineStroke: 'red',
        lineCenterStroke: '#ddd',
      }
    }
  ]
};

var graph1 = new D3RGraph('#graph-1', data1, {
  progressiveLoading: true,
  zoomMinScale: 0.2,
  zoomMaxScale: 0.8,
  zoomInitialScale: 0.4,
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
graph1.on(D3RGraph.Events.ITEM_CLICK, function(graph, item){firedEvents.itemClick = {graph: graph, item:item};});


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

  test('zoom', function(){
    equal(graph1.zoom(), 0.4);
    ok(!graph1.zoom(0.1));
    equal(graph1.zoom(), 0.4);
    ok(!graph1.zoom(1));
    equal(graph1.zoom(), 0.4);
    ok(graph1.zoom(0.6));
    equal(graph1.zoom(), 0.6);
  });

  test('events', function() {
    ok(firedEvents.beforeLoad, 'should fire BEFORE_LOAD');
    ok(firedEvents.loading, 'should fire LOADING');
    ok(firedEvents.loaded, 'should fire LOADED');
    ok(firedEvents.drew, 'should fire DREW');

    firedEvents.zoomed = null;
    graph1.zoom(0.6);
    ok(firedEvents.zoomed, 'should fire ZOOMED');

    firedEvents.itemClick = null;
    $('#'+data1.nodes[1].groupId).d3Click();
    ok(firedEvents.itemClick, 'should fire ITEM_CLICK');
    equal(firedEvents.itemClick.item, data1.nodes[1], 'should pass in clicked node');

    firedEvents.itemClick = null;
    $('#'+data1.links[0].lineId).d3Click();
    ok(firedEvents.itemClick, 'should fire ITEM_CLICK');
    equal(firedEvents.itemClick.item, data1.links[0], 'should pass in clicked link');
  });

  test('styles', function(assert){
    $('#graph-1 .background').d3Click();
    equal($('#graph-1 .background').attr('fill'), 'gray', 'should use custom background color');

    var text = $('#'+data1.nodes[0].groupId+' text');
    equal(text.attr('font-size'), '15px');

    var line1 = $('#'+data1.links[0].lineId);
    equal(line1.attr('stroke'), data1.links[0].styles.lineStroke, 'should apply custom line stroke style');
    equal(line1.attr('stroke-width'), data1.links[0].styles.lineStrokeWidth, 'should apply custom line stroke-width style');

    var line2 = $('#'+data1.links[1].lineId);
    equal(line2.attr('stroke'), D3RGraph.DEFAULT_LINK_STYLES.lineStroke, 'should apply default line stroke style');
    equal(line2.attr('stroke-width'), D3RGraph.DEFAULT_LINK_STYLES.lineStrokeWidth, 'should apply default line stroke-width style');

    $('#'+data1.nodes[0].groupId).d3Click();

    var done = assert.async();
    var centerCircle = $('#'+data1.nodes[0].groupId+' circle');
    var highlightedCircle = $('#'+data1.nodes[1].groupId+' circle');
    var maskedCircle = $('#'+data1.nodes[2].groupId+' circle');

    Q().delay(700).then(function(){
      equal(centerCircle.attr('fill'), data1.styles.circleCenterFill);
      equal(centerCircle.attr('stroke'), data1.styles.circleCenterStroke);
      equal(centerCircle.attr('stroke-width'), data1.styles.circleCenterStrokeWidth);
      notEqual(centerCircle.attr('style').indexOf('scale('+data1.styles.circleCenterScale), -1);

      equal(highlightedCircle.attr('fill'), data1.styles.circleHighlightedFill);
      equal(highlightedCircle.attr('stroke'), data1.styles.circleHighlightedStroke);
      equal(highlightedCircle.attr('stroke-width'), data1.styles.circleHighlightedStrokeWidth);
      notEqual(highlightedCircle.attr('style').indexOf('scale('+data1.styles.circleHighlightedScale), -1);

      equal(maskedCircle.attr('fill'), data1.styles.circleFill);
      equal(maskedCircle.attr('stroke'), D3RGraph.DEFAULT_NODE_STYLES.circleStroke);
      equal(maskedCircle.attr('stroke-width'), D3RGraph.DEFAULT_NODE_STYLES.circleStrokeWidth);

      equal(line1.attr('stroke'), data1.links[0].styles.lineHighlightedStroke, 'should apply custom line stroke for highlighting');
      equal(line1.attr('stroke-width'), data1.links[0].styles.lineHighlightedStrokeWidth, 'should apply custom line stroke-width for highlighting');
      equal(line2.attr('stroke'), data1.styles.lineHighlightedStroke, 'should apply custom line stroke for highlighting from global');
      equal(line2.attr('stroke-width'), data1.links[1].styles.lineHighlightedStrokeWidth, 'should apply custom line stroke-width for highlighting');

      $('#graph-1 .background').d3Click();
    })
    .delay(700).then(function(){
      equal(centerCircle.attr('fill'), data1.nodes[0].styles.circleFill, 'should use node style');
      equal(centerCircle.attr('stroke'), D3RGraph.DEFAULT_NODE_STYLES.circleStroke);
      equal(centerCircle.attr('stroke-width'), D3RGraph.DEFAULT_NODE_STYLES.circleStrokeWidth);
      notEqual(centerCircle.attr('style').indexOf('scale(1'), -1);

      equal(highlightedCircle.attr('fill'), data1.nodes[1].styles.circleFill, 'should use node style');
      equal(highlightedCircle.attr('stroke'), D3RGraph.DEFAULT_NODE_STYLES.circleStroke);
      equal(highlightedCircle.attr('stroke-width'), D3RGraph.DEFAULT_NODE_STYLES.circleStrokeWidth);
      notEqual(highlightedCircle.attr('style').indexOf('scale(1'), -1);

      equal(maskedCircle.attr('fill'), data1.styles.circleFill, 'should use global style');
      equal(maskedCircle.attr('stroke'), D3RGraph.DEFAULT_NODE_STYLES.circleStroke);
      equal(maskedCircle.attr('stroke-width'), D3RGraph.DEFAULT_NODE_STYLES.circleStrokeWidth);

      equal(line1.attr('stroke'), data1.links[0].styles.lineStroke, 'should restore custom line stroke style after cancel highlighting');
      equal(line1.attr('stroke-width'), data1.links[0].styles.lineStrokeWidth, 'should restore custom line stroke-width style after cancel highlighting');
      equal(line2.attr('stroke'), D3RGraph.DEFAULT_LINK_STYLES.lineStroke, 'should restore default line stroke style after cancel highlighting');
      equal(line2.attr('stroke-width'), D3RGraph.DEFAULT_LINK_STYLES.lineStrokeWidth, 'should restore default line stroke-width style after cancel highlighting');
    })
    .done(done);
  });

  test('centering', function(assert){
    var prePosition = graph2.zoomBehavior.translate();
    var done = assert.async();
    $('#'+data2.nodes[0].groupId).d3Click();

    Q().delay(700).then(function() {
      var curPosition = graph2.zoomBehavior.translate();
      notEqual(prePosition, curPosition);

      prePosition = graph2.zoomBehavior.translate();
      $('#'+data2.links[0].lineId).d3Click();
    }).delay(700)
    .then(function(){
      var curPosition = graph2.zoomBehavior.translate();
      notEqual(prePosition, curPosition);
    })
    .done(done);
  });

  test('highlighting and relations', function(assert){
    var relations = graph2.getNodeRelations(data2.nodes[1].id);
    equal(relations.nodes.length, 1);
    equal(relations.links.length, 1);
    equal(relations.nodeIds.length, 1);
    equal(relations.lineIds.length, 1);
    equal(relations.nodes[0], data2.nodes[0]);

    relations = graph2.getNodeRelations(data2.nodes[3].id);
    ok(!relations, 'the 4th node does not have any relations');

    var done = assert.async();
    $('#'+data1.nodes[3].groupId).d3Click();

    Q().delay(700).then(function(){
      ok($('#'+data1.nodes[0].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[3].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[3].groupId).attr('class').indexOf('center') !== -1);
      ok($('#'+data1.nodes[1].groupId).attr('class').indexOf('highlighted-node') === -1);
      ok($('#'+data1.nodes[2].groupId).attr('class').indexOf('highlighted-node') === -1);

      ok($('#'+data1.links[1].lineId).attr('class').indexOf('highlighted-line') !== -1);
      ok($('#'+data1.links[0].lineId).attr('class').indexOf('highlighted-line') === -1);

      $('#'+data1.nodes[0].groupId).d3Click();
    })
    .delay(700).then(function(){
      ok($('#'+data1.nodes[0].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[0].groupId).attr('class').indexOf('center') !== -1);
      ok($('#'+data1.nodes[3].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[1].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[2].groupId).attr('class').indexOf('highlighted-node') === -1);

      ok($('#'+data1.links[1].lineId).attr('class').indexOf('highlighted-line') !== -1);
      ok($('#'+data1.links[0].lineId).attr('class').indexOf('highlighted-line') !== -1);

      $('#'+data1.links[0].lineId).d3Click();
    })
    .delay(700).then(function(){
      ok($('#'+data1.links[0].lineId).attr('class').indexOf('highlighted-line') !== -1);
      ok($('#'+data1.links[0].lineId).attr('class').indexOf('center') !== -1);
      ok($('#'+data1.links[1].lineId).attr('class').indexOf('highlighted-line') === -1);

      ok($('#'+data1.nodes[0].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[1].groupId).attr('class').indexOf('highlighted-node') !== -1);
      ok($('#'+data1.nodes[2].groupId).attr('class').indexOf('highlighted-node') === -1);
      ok($('#'+data1.nodes[3].groupId).attr('class').indexOf('highlighted-node') === -1);
    })
    .done(done);
  });

  test('toggle nodes', function(){
    graph2.toggleNodes('a');
    notEqual($('#'+data2.nodes[1].groupId).css('display'), 'none');
    notEqual($('#'+data2.nodes[3].groupId).css('display'), 'none');

    equal($('#'+data2.nodes[0].groupId).css('display'), 'none');
    equal($('#'+data2.nodes[2].groupId).css('display'), 'none');
    equal($('#'+data2.links[0].lineId).css('display'), 'none');
    equal($('#'+data2.links[1].lineId).css('display'), 'none');


    graph2.toggleNodes('b');
    notEqual($('#'+data2.nodes[3].groupId).css('display'), 'none');

    equal($('#'+data2.nodes[0].groupId).css('display'), 'none');
    equal($('#'+data2.nodes[2].groupId).css('display'), 'none');
    equal($('#'+data2.nodes[1].groupId).css('display'), 'none');
    equal($('#'+data2.links[0].lineId).css('display'), 'none');
    equal($('#'+data2.links[1].lineId).css('display'), 'none');


    graph2.toggleNodes('a');
    notEqual($('#'+data2.nodes[3].groupId).css('display'), 'none');
    notEqual($('#'+data2.nodes[0].groupId).css('display'), 'none');
    notEqual($('#'+data2.nodes[2].groupId).css('display'), 'none');
    notEqual($('#'+data2.links[1].lineId).css('display'), 'none');

    equal($('#'+data2.nodes[1].groupId).css('display'), 'none');
    equal($('#'+data2.links[0].lineId).css('display'), 'none');


    graph2.toggleNodes('e', false);
    equal($('#'+data2.nodes[0].groupId).css('display'), 'none');

    notEqual($('#'+data2.nodes[3].groupId).css('display'), 'none');
    notEqual($('#'+data2.nodes[2].groupId).css('display'), 'none');
    equal($('#'+data2.links[1].lineId).css('display'), 'none');;
    equal($('#'+data2.links[0].lineId).css('display'), 'none');
  });

  test('validations', function(assert){
    assert.throws(function(){
      new D3RGraph('#', {
        nodes: []
      });
    },
    'D3RGraph: Node length must not be zero.',
    'Empty node');

    assert.throws(function(){
      new D3RGraph('#', {
        nodes: [
          {id: 1 },
          {id: 1 },
          {id: 2 },
          {id: 1 },
        ]
      });
    },
    'D3RGraph: Found duplicate node id: 1. Id exists in nodes: 0, 1, 3',
    'Duplicate id');

    assert.throws(function(){
      new D3RGraph('#', {
        nodes: [
          {},
          {},
          {}
        ],
        links: [
          {source: 0, target: 5},
        ]
      });
    },
    'D3RGraph: Link (source: 0, target: 5) does not exist.',
    'Invalid Link');

    assert.throws(function(){
      new D3RGraph('#', {
        nodes: [
          {},
          {},
          {}
        ],
        links: [
          {source: 0, target: 1},
          {source: 0, target: 1},
        ]
      });
    },
    'D3RGraph: Fond duplicate link (source: 0, target: 1).',
    'Duplicate Link');
  });

}

graph1.draw();
graph2.draw();
