/*jslint latedef:false */
/*global EventEmitter:false */

(function(){
  'use strict';

  var DEFAULT_OPTIONS = {
    highlightHoveringNode: true,
    highlightClickedNode: true,
    highlightingDelays: 300,      // Highlight hovered node and its connected edges and nodes.
    centerClickedNode: true,
    centeringDuration: 500,       // annimation duration for centering
    maxTitleLength: 20,           // title longer than the maximum length will be trimmed.

    zoomMinScale: 0.4,
    zoomMaxScale: 1,
    zoomInitialScale: 1,

    nodeDefaultTitle: 'untitled',

    progressiveLoading: false,
    tickCount: null,
    loadingInterval: 10,
  };

  var DEFAULT_GLOBAL_STYLES = {
    maskedOpacity: 0.2,
    backgroundFill: '#FAFAFA',
  };

  var DEFAULT_NODE_STYLES = {
    circleR: 17,            // circle radius
    circleFill: '#00F',     // circle fill
    circleStroke: '#999',   // circle stroke color
    circleStrokeWidth: 1,   // circle stroke width

    circleHighlightedScale: 1.5,
    circleHighlightedStroke: '#888',
    circleHighlightedStrokeWidth: 2,

    labelFontSize: 12,      // lable (beside its circle) font size
  };

  var DEFAULT_LINK_STYLES = {
    lineStroke: '#DDD',     // line (between circles) color
    lineStrokeWidth: 1.5,   // line stroke width
  };

  var EVENTS = {
    BEFORE_LOAD: 'BEFORE_LOAD',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    DREW: 'DREW',
    ZOOMED: 'ZOOMED',
    NODE_CLICK: 'NODE_CLICK',
  };

  var instanceCounter = 0;
  function Graph(svgSelector, graphJson, options){
    this.svgSelector = svgSelector;
    this.id = 'g'+(instanceCounter++);
    assignDefaultValues(graphJson, this.id+'-');
    this.graphJson = graphJson;
    this.styles = graphJson.styles;
    this.options = merge(DEFAULT_OPTIONS, options);
  }
  window.D3RGraph = Graph;
  Graph.Events = EVENTS;

  Graph.prototype.draw = function(){
    var self = this;
    if(self.svg) return null;
    // Inside the draw function, it does two things:
    // First it tick the graph for nodes.length*nodes.length times to put the nodes in the right position
    // Then it create the elemtns (circles, lines, etc.) based on node positions.

    self.svg = d3.select(self.svgSelector);
    self.force = d3.layout.force()
        .linkDistance(150)
        .charge(-2500)
        .chargeDistance(1000)
        .size([20000, 20000])  // make layout large enough to hold all nodes.
        .nodes(self.graphJson.nodes)
        .links(self.graphJson.links)
        .start();

    self.graphJson.nodes.forEach(function(node) {
      node.title = node.title || self.options.nodeDefaultTitle;
      if(node.title.length > self.options.maxTitleLength)
        node.shortTitle = node.title.substr(0, self.options.maxTitleLength/2) + '...' +
            node.title.substr(-(self.options.maxTitleLength/2));
      else
        node.shortTitle = node.title;

      node.groupId = 'graph-group-' + node.id;
      node.circleId = 'graph-circle-' + node.id;
      node.textId = 'graph-text-' + node.id;
    });

    self.graphJson.links.forEach(function(link) {
      link.lineId = 'graph-link-' + link.source.id + '-' + link.target.id;
    });

    self.zoomBehavior = d3.behavior.zoom()
        .scaleExtent([self.options.zoomMinScale, self.options.zoomMaxScale]);

    self._fire(Graph.Events.BEFORE_LOAD);

    var nodesLength = self.graphJson.nodes.length;
    var tickCount = self.options.tickCount || Math.max(nodesLength*nodesLength/50, 2500);

    if(self.options.progressiveLoading){
      tickGraph();
    }else{
      self.force.start();
      for (var i = 1; i <= tickCount; i++){
        self.force.tick();
      }
      self.force.stop();
      self._fire(Graph.Events.LOADED);
      createGraphElements();
    }

    function tickGraph(tickProgress){
      tickProgress = tickProgress || 0;

      if(tickProgress === 0){
        self.force.start();
      }

      // Run the layout a fixed number of times.
      // The ideal number of times scales with graph complexity.
      // Of course, don't run too long—you'll hang the page!
      var onePercentTickCount = Math.round(tickCount*0.1)/10;
      for (var i = 1; i <= onePercentTickCount; i++){
        self.force.tick();
      }

      tickProgress++;
      self._fire(Graph.Events.LOADING, [tickProgress]);

      if(tickProgress !== 100){ // continue ticking
        setTimeout(function(){tickGraph(tickProgress);}, self.options.loadingInterval);
      }else{ // tick done
        self.force.stop();
        self._fire(Graph.Events.LOADED);
        createGraphElements();
      }
    }

    function createGraphElements(){
      // Add container on top of everything, so that user can perform drag events on it.
      self.graphContainer = self.svg.append('g')
          .attr('class', 'graph-container');

      // Add background
      self.background = self.graphContainer.append('rect')
          .attr('class', 'background')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('fill', self.styles.backgroundFill);

      // Add container to hold all circles and lines.
      self.nodesContainer = self.graphContainer.append('g')
          .attr('class', 'nodes-container');


      // Add lines
      self.links = self.nodesContainer.selectAll('.link')
          .data(self.graphJson.links)
          .enter()
            .append('line')
            .attr('class', 'graph-link')
            .attr('id', function(d){ return d.lineId;})
            .attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; })
            .attr('stroke', function(d){ return d.styles.lineStroke; })
            .attr('stroke-width', function(d){ return d.styles.lineStrokeWidth; });

      // Add containers for all circles and labels.
      self.positions = {
        maxNodeX: null,
        maxNodeY: null,
        minNodeX: null,
        minNodeY: null
      };
      self.nodes = self.nodesContainer.selectAll('.node')
          .data(self.graphJson.nodes)
          .enter()
            .append('g')
            .attr('title', function(d){ return d.title; })
            .attr('id', function(d){ return d.groupId; })
            .attr('transform', function(d) {
              self.positions.maxNodeX = Math.max(self.positions.maxNodeX || d.x, d.x);
              self.positions.maxNodeY = Math.max(self.positions.maxNodeY || d.y, d.y);
              self.positions.minNodeX = Math.min(self.positions.minNodeX || d.x, d.x);
              self.positions.minNodeY = Math.min(self.positions.minNodeY || d.y, d.y);
              return 'translate('+d.x+','+d.y+')';
            });

      self.positions.nodesWidth = Math.round(self.positions.maxNodeX-self.positions.minNodeX);
      self.positions.nodesHeight = Math.round(self.positions.maxNodeY-self.positions.minNodeY);

      // Add circles
      self.circles = self.nodes.append('circle')
          .attr('class', 'graph-circle')
          .attr('id', function(d){ return d.circleId; })
          .attr('r', function(d){ return d.styles.circleR; })
          .attr('fill', function(d){ return d.styles.circleFill; })
          .attr('stroke', function(d){ return d.styles.circleStroke; })
          .attr('stroke-width', function(d){ return d.styles.circleStrokeWidth; })
          .style('transition', 'all 0.2s ease-in-out');

      // Add labels
      self.labels = self.nodes.append('text')
          .attr('dx', function(d){ return d.styles.circleR*1.5+3; })
          .attr('dy', function(d){ return (d.styles.labelFontSize-2)/2; })
          .attr('id', function(d){ return d.textId; })
          .attr('font-size', function(d){ return d.styles.labelFontSize + 'px'; })
          .text(function(d) { return d.shortTitle; });

      self._bindResizeEvent();
      self._bindNodeHighlightingEvents();
      self._bindNodeClickingEvents();
      self._bindZoomAndDragEvents();
      self.zoom(self.options.zoomInitialScale);

      self._fire(Graph.Events.DREW);
    }
  };

  Graph.prototype.centerNode = function(nodeId){
    var self = this;
    var node = this.getNode(nodeId);
    var scale = this.zoom();
    var x = -node.px*scale + this.positions.svgWidth/2;
    var y = -node.py*scale + this.positions.svgHeight/2;
    var nodesCenter = this._getNodesCenter(scale);
    self._centeringNode = true;
    this.zoomBehavior.translate([x-nodesCenter.x, y-nodesCenter.y]);
    this.nodesContainer
        .transition()
        .duration(self.options.centeringDuration)
        .attr('transform', 'translate('+x+','+y+')scale('+scale+')')
        .each('end', function(){
          self._trackZoomPosition();
          self._centeringNode = false;
        });
  };

  Graph.prototype.getRelations = function(nodeId){
    nodeId = nodeId.toString();
    if(!this._relations){
      this._relations = {};
      var self = this;
      this.graphJson.links.forEach(function(link) {
        addConnection(link.source, link.target, link);
        addConnection(link.target, link.source, link);

        function addConnection(source, target, link) {
          var sourceId = source.id;
          var targetId = target.id;
          var lineId = link.lineId;
          if(!self._relations[sourceId])
            self._relations[sourceId] = {nodeIds: [], lineIds: [], nodes: [], links: []};

          self._relations[sourceId].nodeIds.push(targetId);
          self._relations[sourceId].lineIds.push(lineId);
          self._relations[sourceId].nodes.push(target);
          self._relations[sourceId].links.push(link);
        }
      });
    }

    return this._relations[nodeId];
  };

  Graph.prototype.getNode = function(nodeId){
    if(!this._idMapNodes){
      this._idMapNodes = {};
      for(var i = 0; i < this.graphJson.nodes.length; i++){
        var node = this.graphJson.nodes[i];
        this._idMapNodes[node.id] = node;
      }
    }
    return this._idMapNodes[nodeId];
  };

  Graph.prototype.highlightNode = function(nodeId, options){
    options = merge({
      highlightRelated: true,
      keepHighlighting: false,
      cancelPreviousHighlightedNode: true,
    }, options);

    this._highlightedNode = {nodeId: nodeId, options: options};

    if(options.cancelPreviousHighlightedNode){
      var previousNode = this.svg.select('.highlighted-node.center').data()[0];
      if(previousNode && previousNode.id !== nodeId){
        this.unhighlightNodes();
      }
    }

    nodeId = nodeId.toString();
    this._keepHighlighting = options.keepHighlighting;
    this.nodes.classed('masked', true);
    this.links.classed('masked', true);

    var centerNodeSelector = '#graph-group-' + nodeId;
    this.svg.select(centerNodeSelector)
        .classed('masked', false)
        .classed('highlighted-node', true)
        .classed('center', true);

    if(options.highlightRelated){
      var connections = this.getRelations(nodeId);
      if(connections){
        var relatedNodeSelector = '#graph-group-' + connections.nodeIds.join(', #graph-group-');
        this.svg.selectAll(relatedNodeSelector)
            .classed('masked', false)
            .classed('highlighted-node', true);

        var relatedLinkSelector = '#' + connections.lineIds.join(', #');
        this.svg.selectAll(relatedLinkSelector)
            .classed('masked', false)
            .classed('highlighted-edge', true);
      }
    }

    // Perform Annimation
    this.svg.selectAll('.masked').attr('opacity', this.styles.maskedOpacity);
    var style = this._getStyle('.highlighted-node.center circle');
    var scale = 'scale('+style.circleHighlightedScale+','+style.circleHighlightedScale+')';
    this.svg.select('.highlighted-node.center circle')
        .style('transform', scale)
        .style('-webkit-transform', scale) // safari
        .attr('stroke', style.circleHighlightedStroke)
        .attr('stroke-width', style.circleHighlightedStrokeWidth);
  };

  Graph.prototype.unhighlightNodes = function(){
    this._highlightedNode = null;
    this.svg.selectAll('.masked').attr('opacity', 1);

    var style = this._getStyle('.highlighted-node.center circle');
    if(style){
      this.svg.select('.highlighted-node.center circle')
        .style('transform', 'scale(1,1)')
        .style('-webkit-transform', 'scale(1,1)') // safari
        .attr('stroke', style.circleStroke)
        .attr('stroke-width', style.circleStrokeWidth);
    }

    this.nodes
        .classed('masked', false)
        .classed('highlighted-node', false)
        .classed('center', false)
        .classed('highlighted-edge', false);

    this.links
        .classed('masked', false)
        .classed('highlighted-edge', false);

    this._keepHighlighting = false;
  };

  Graph.prototype.zoom = function(scale){
    if(!scale) return this.zoomBehavior.scale();
    var position = this.zoomBehavior.translate();
    this.zoomBehavior
        .translate(position)
        .scale([scale])
        .event(this.nodesContainer);
  };

  Graph.prototype.on = function(event, callback){
    event = event || 'undefined';

    if(!this.events){
      this.events = typeof(EventEmitter) !== 'undefined' ? new EventEmitter() : null;
      if(!this.events) throw 'EventEmitter is required for graph events';
    }

    if(!Graph.Events[event]) throw 'Invalid event: ' + event;
    this.events.addListener(event, callback);
    return true;
  };

  Graph.prototype._fire = function(eventName, params){
    if(!this.events) return null;
    this.events.emitEvent(eventName, [this].concat(params));
    return true;
  };

  Graph.prototype._bindNodeHighlightingEvents = function(){
    var self = this;
    var highlightTimeoutId;
    this.nodes.on('mouseover', function(node) {
      if(!self.options.highlightHoveringNode || self._keepHighlighting || self._isCenteringNode()) return;

      if(highlightTimeoutId){
        clearTimeout(highlightTimeoutId);
        highlightTimeoutId = null;
      }
      highlightTimeoutId = setTimeout(function(){
        if(self._isCenteringNode()) return;
        self.svg.selectAll('#'+node.textId).text(node.title);
        self.highlightNode(node.id);
      }, self.options.highlightingDelays);
    });

    this.nodes.on('mouseout', function(d) {
      if(self._isCenteringNode()) return;

      if(highlightTimeoutId){
        clearTimeout(highlightTimeoutId);
        highlightTimeoutId = null;
      }

      if(!self.options.highlightHoveringNode || self._keepHighlighting) return;

      self.svg.select('#'+d.textId).text(d.shortTitle);
      self.unhighlightNodes();
    });
  };

  Graph.prototype._bindNodeClickingEvents = function(){
    var self = this;
    this.nodes.on('mouseup', function(node) {
      if(self._isDragged()) return false;

      if(self.options.highlightClickedNode)
        self.highlightNode(node.id, {keepHighlighting: true});

      if(self.options.centerClickedNode)
        self.centerNode(node.id);

      self._fire(Graph.Events.NODE_CLICK, [node]);
    });
  };

  Graph.prototype._bindZoomAndDragEvents = function(){
    var self = this;

    self.zoomBehavior
        .size([self.positions.nodesWidth, self.positions.nodesHeight])
        .on('zoom', function(){
          zoom(d3.event.scale, d3.event.translate);
        })
        .on('zoomstart', function(){
          self._trackZoomPosition();
        })
        .on('zoomend', function(){
          self._trackZoomPosition();
        });
    self.graphContainer.call(self.zoomBehavior);

    var DBL_CLICK_SCALE = 0.05;
    self.background.on('dblclick', function(){
      zoom(self.zoom()-DBL_CLICK_SCALE, self.zoomBehavior.translate());
    });

    self.background.on('mouseup', function(){
      if(!self._isDragged()) self.unhighlightNodes();
    });

    function zoom(scale, dragPosition) {
      var svgPosition = self._getSvgPosition(dragPosition, scale);
      self.nodesContainer.attr('transform', 'translate(' + svgPosition + ')scale(' + scale + ')');
      self._fire(Graph.Events.ZOOMED, [scale]);
    }
    var nodesCenter = self._getNodesCenter(1);
    var svgCenterX = self.positions.svgWidth/2;
    var svgCenterY = self.positions.svgHeight/2;
    var initialX = nodesCenter.x + svgCenterX;
    var initialY = nodesCenter.y + svgCenterY;

    self.zoomBehavior.translate([svgCenterX, svgCenterY]);
    self.nodesContainer.attr('transform', 'translate('+[initialX, initialY]+')scale(1)');
  };


  Graph.prototype._getNodesCenter = function(scale){
    var x = (-this.positions.minNodeX - this.positions.nodesWidth/2)*scale;
    var y = (-this.positions.minNodeY - this.positions.nodesHeight/2)*scale;
    return {x:x, y:y};
  };

  Graph.prototype._isDragged = function(){
    var curZoomPosition = this.zoomBehavior.translate();
    return this.previousZoomPosition && (
             curZoomPosition[0] !== this.previousZoomPosition[0] ||
             curZoomPosition[1] !== this.previousZoomPosition[1]
           );
  };

  Graph.prototype._isCenteringNode = function(){
    return this._centeringNode;
  };

  Graph.prototype._trackZoomPosition = function(){
    this.previousZoomPosition = this.zoomBehavior.translate();
  };

  Graph.prototype._getSvgPosition = function(dragPosition, scale){
    var nodesCenter = this._getNodesCenter(scale);
    var x = nodesCenter.x + dragPosition[0];
    var y = nodesCenter.y + dragPosition[1];
    return [x, y];
  };

  Graph.prototype._getStyle = function(selector) {
    var data = this.svg.select(selector).data()[0];
    return data ? data.styles : null;
  };

  Graph.prototype._bindResizeEvent = function(){
    var self = this;
    updatePositions();
    d3.select(window).on('resize.'+this.id, updatePositions);

    function updatePositions(){
      self.positions.svgWidth = parseInt(self.svg.style('width'));
      self.positions.svgHeight = parseInt(self.svg.style('height'));
      if(self._highlightedNode) self.centerNode(self._highlightedNode.groupId);
    }
  };

  function assignDefaultValues(data, idPrefix){
    data.styles = merge(DEFAULT_GLOBAL_STYLES, data.styles);

    var nodes = data.nodes;
    for(var i = 0; i < nodes.length; i++){
      var node = nodes[i];
      node.id = idPrefix+(node.id || i).toString();
      node.styles = merge(DEFAULT_NODE_STYLES, node.styles);
    }

    var links = data.links;
    for(var j = 0; j < links.length; j++){
      var link = links[j];
      link.styles = merge(DEFAULT_LINK_STYLES, link.styles);
    }
  }

  function merge(to, from) {
    var result = {};
    to = to || {};
    from = from || {};
    for(var key in to){
      result[key] = to[key];
    }
    for(key in from){
      result[key] = from[key];
    }
    return result;
  }
})();
