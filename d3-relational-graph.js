/*jslint latedef:false */
/*global EventEmitter:false */

(function(){
  'use strict';

  var DEFAULT_OPTIONS = {
    highlightHoveringNode: true,
    highlightClickedNode: true,
    highlightHoveringLink: true,
    highlightClickedLink: true,
    highlightingDelays: 300,      // Highlight hovered node and its connected edges and nodes.

    centerClickedNode: true,
    centerClickedLink: true,
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

    circleHighlightedScale: 1,
    circleHighlightedFill: null,
    circleHighlightedStroke: null,
    circleHighlightedStrokeWidth: null,

    circleCenterScale: 1.5,
    circleCenterFill: null,
    circleCenterStroke: null,
    circleCenterStrokeWidth: null,

    labelFontSize: 12,      // lable (beside its circle) font size
  };

  var DEFAULT_LINK_STYLES = {
    lineStroke: '#DDD',     // line (between circles) color
    lineStrokeWidth: 3,   // line stroke width

    lineHighlightedStroke: null,
    lineHighlightedStrokeWidth: 4,

    lineCenterStroke: null,
    lineCenterStrokeWidth: 4,
  };

  var EVENTS = {
    BEFORE_LOAD: 'BEFORE_LOAD',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    DREW: 'DREW',
    ZOOMED: 'ZOOMED',
    NODE_CLICK: 'NODE_CLICK',
    LINK_CLICK: 'LINK_CLICK',
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
  Graph.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
  Graph.DEFAULT_LINK_STYLES = DEFAULT_LINK_STYLES;
  Graph.DEFAULT_NODE_STYLES = DEFAULT_NODE_STYLES;
  Graph.DEFAULT_GLOBAL_STYLES = DEFAULT_GLOBAL_STYLES;

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
      node.typeClass = 'graph-type-' + (node.type || 'none');
    });

    self.graphJson.links.forEach(function(link) {
      link.lineId = 'graph-line-' + link.id;
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
            .attr('stroke-width', function(d){ return d.styles.lineStrokeWidth; })
            .style('transition', 'all 0.2s ease-in-out');

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
            .attr('class', function(d){ return d.typeClass; })
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
      self._bindItemHighlightingEvents();
      self._bindItemClickingEvents();
      self._bindZoomAndDragEvents();
      self.zoom(self.options.zoomInitialScale);

      self._fire(Graph.Events.DREW);
    }
  };

  // id is node or link id
  Graph.prototype.centerItem = function(id){
    var self = this;
    var item = this.getItem(id);
    var scale = this.zoom();
    var nodesCenter = this._getNodesCenter(scale);
    var x, y;

    if(item.isNode){
      x = -item.px*scale + this.positions.svgWidth/2;
      y = -item.py*scale + this.positions.svgHeight/2;
    }else{
      var source = item.source;
      var target = item.target;
      x = Math.min(source.px, target.px) + Math.abs(Math.abs(source.px) - Math.abs(target.px))/2;
      y = Math.min(source.py, target.py) + Math.abs(Math.abs(source.py) - Math.abs(target.py))/2;
      x = -x*scale + this.positions.svgWidth/2;
      y = -y*scale + this.positions.svgHeight/2;
    }

    self._centeringItem = true;
    this.zoomBehavior.translate([x-nodesCenter.x, y-nodesCenter.y]);
    this.nodesContainer
        .transition()
        .duration(self.options.centeringDuration)
        .attr('transform', 'translate('+x+','+y+')scale('+scale+')')
        .each('end', function(){
          self._trackZoomPosition();
          self._centeringItem = false;
        });
  };

  Graph.prototype.getNodeRelations = function(nodeId){
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

  // node or link id (node.id or link.id)
  Graph.prototype.getItem = function(id){
    if(!this._idMapData){
      this._idMapData = {};
      for(var i = 0; i < this.graphJson.nodes.length; i++){
        var node = this.graphJson.nodes[i];
        this._idMapData[node.id] = node;
      }
      for(var j = 0; j < this.graphJson.links.length; j++){
        var link = this.graphJson.links[j];
        this._idMapData[link.id] = link;
      }
    }
    return this._idMapData[id];
  };

  Graph.prototype.highlightNode = function(nodeId, options){
    nodeId = nodeId.toString();
    if(!this.getItem(nodeId)) return false;

    options = merge({
      highlightRelated: true,
      keepHighlighting: false,
    }, options);

    this._cancelCurrentHighlighting(nodeId);
    this._highlightedItem = {id: nodeId, options: options};

    this._keepHighlighting = options.keepHighlighting;
    this.nodes.classed('masked', true);
    this.links.classed('masked', true);

    var centerNodeSelector = '#graph-group-' + nodeId;
    this.svg.select(centerNodeSelector)
        .classed('masked', false)
        .classed('highlighted-node', true)
        .classed('center', true);

    if(options.highlightRelated){
      var connections = this.getNodeRelations(nodeId);
      if(connections){
        var relatedNodeSelector = '#graph-group-' + connections.nodeIds.join(', #graph-group-');
        this.svg.selectAll(relatedNodeSelector)
            .classed('masked', false)
            .classed('highlighted-node', true);

        var relatedLinkSelector = '#' + connections.lineIds.join(', #');
        this.svg.selectAll(relatedLinkSelector)
            .classed('masked', false)
            .classed('highlighted-line', true);
      }
    }

    this._applyStyles(true, nodeId);
  };

  Graph.prototype.highlightLink = function(linkId, options){
    linkId = linkId.toString();
    var link = this.getItem(linkId);
    if(!link) return false;

    options = merge({
      keepHighlighting: false,
    }, options);

    this._cancelCurrentHighlighting(linkId);
    this._highlightedItem = {id: linkId, options: options};

    this._keepHighlighting = options.keepHighlighting;
    this.nodes.classed('masked', true);
    this.links.classed('masked', true);

    var centerLineSelector = '#graph-line-' + linkId;
    this.svg.select(centerLineSelector)
        .classed('masked', false)
        .classed('highlighted-line', true)
        .classed('center', true);

    this.svg.selectAll('#'+link.target.groupId+', #'+link.source.groupId)
        .classed('masked', false)
        .classed('highlighted-node', true)
        .classed('center', true);

    this._applyStyles(true, null, linkId);
  };

  Graph.prototype.unhighlightAll = function(){
    this._highlightedItem = null;
    this.svg.selectAll('.masked').attr('opacity', 1);

    this._applyStyles(false);

    this.nodes
        .classed('masked', false)
        .classed('highlighted-node', false)
        .classed('center', false)
        .classed('highlighted-line', false);

    this.links
        .classed('masked', false)
        .classed('highlighted-line', false);

    this._keepHighlighting = false;
  };

  Graph.prototype._cancelCurrentHighlighting = function(idToBeHighlighted){
    var previousLink = this.svg.select('.highlighted-line.center').data()[0];
    if(previousLink && previousLink.id !== idToBeHighlighted){
      this.unhighlightAll();
      return;
    }

    var previousNode = this.svg.select('.highlighted-node.center').data()[0];
    if(previousNode && previousNode.id !== idToBeHighlighted){
      this.unhighlightAll();
    }
  };

  Graph.prototype._applyStyles = function(isHighlighting, centerNodeId, centerLinkId){
    if(isHighlighting){
      this.svg.selectAll('.masked').attr('opacity', this.styles.maskedOpacity);
      this.svg.selectAll('.highlighted-node circle')
          .style('transform', function(d){
            return scaleAttr((centerLinkId || d.id === centerNodeId) ? d.styles.circleCenterScale : d.styles.circleHighlightedScale);
          })
          .style('-webkit-transform', function(d){ // fix safari
            return scaleAttr((centerLinkId || d.id === centerNodeId) ? d.styles.circleCenterScale : d.styles.circleHighlightedScale);
          })
          .attr('fill', function(d){
            return d.id === centerNodeId ? d.styles.circleCenterFill : d.styles.circleHighlightedFill;
          })
          .attr('stroke', function(d){
            return d.id === centerNodeId ? d.styles.circleCenterStroke : d.styles.circleHighlightedStroke;
          })
          .attr('stroke-width', function(d){
            return d.id === centerNodeId ? d.styles.circleCenterStrokeWidth : d.styles.circleHighlightedStrokeWidth;
          });

      this.svg.selectAll('.highlighted-line')
          .attr('stroke', function(d){
            return d.id === centerLinkId ? d.styles.lineCenterStroke : d.styles.lineHighlightedStroke;
          })
          .attr('stroke-width', function(d){
            return d.id === centerLinkId ? d.styles.lineCenterStrokeWidth : d.styles.lineHighlightedStrokeWidth;
          });

    }else{
      this.svg.selectAll('.highlighted-node circle')
          .style('transform', 'scale(1,1)')
          .style('-webkit-transform', 'scale(1,1)') // safari
          .attr('fill', function(d){return d.styles.circleFill;})
          .attr('stroke', function(d){return d.styles.circleStroke;})
          .attr('stroke-width', function(d){return d.styles.circleStrokeWidth;});

      this.svg.selectAll('.highlighted-line')
          .attr('stroke', function(d){return d.styles.lineStroke;})
          .attr('stroke-width', function(d){return d.styles.lineStrokeWidth;});
    }
  };

  Graph.prototype.toggleNodesByType = function(type){
    var typeClass = '.graph-type-' + type;
    var nodeIds = [];
    var lineIds = [];
    var nodes = this.svg.selectAll(typeClass).data();
    if(nodes.length === 0) return;

    var toShow = !nodes[0].shown;

    for(var i = 0; i < nodes.length; i++){
      var node = nodes[i];
      node.shown = toShow;
      nodeIds.push(node.groupId);

      var relations = this.getNodeRelations(node.id);
      if(relations){
        for(var j = 0; j < relations.links.length; j ++){
          var link = relations.links[j];
          if(!toShow || (toShow && link.target.shown === link.source.shown))
            lineIds.push(link.lineId);
        }
      }
    }

    if(nodeIds.length !== 0)
      this.svg.selectAll('#'+nodeIds.join(', #')).style('display', toShow ? 'inline' : 'none');
    if(lineIds.length !== 0)
      this.svg.selectAll('#'+lineIds.join(', #')).style('display', toShow ? 'inline' : 'none');
  };

  Graph.prototype.zoom = function(scale){
    if(!scale) return this.zoomBehavior.scale();
    if(scale < this.options.zoomMinScale || scale > this.options.zoomMaxScale) return false;

    var position = this.zoomBehavior.translate();
    this.zoomBehavior
        .translate(position)
        .scale([scale])
        .event(this.nodesContainer);
    return true;
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

  Graph.prototype._bindItemHighlightingEvents = function(){
    var self = this;
    var highlightTimeoutId;

    this.nodes.on('mouseover', onMouseOver);
    this.links.on('mouseover', onMouseOver);

    this.nodes.on('mouseout', onMouseOut);
    this.links.on('mouseout', onMouseOut);

    function onMouseOver(item) {
      var highlightHovered = item.isNode ? self.options.highlightHoveringNode : self.options.highlightHoveringLink;

      if(!highlightHovered || self._keepHighlighting || self._isCenteringItem()) return;

      if(highlightTimeoutId){
        clearTimeout(highlightTimeoutId);
        highlightTimeoutId = null;
      }
      highlightTimeoutId = setTimeout(function(){
        if(self._isCenteringItem()) return;

        // Expand shorten title
        if(item.isNode) self.svg.select('#'+item.textId).text(item.title);

        if(item.isNode)
          self.highlightNode(item.id);
        else
          self.highlightLink(item.id);
      }, self.options.highlightingDelays);
    }

    function onMouseOut(item) {
      if(self._isCenteringItem()) return;

      if(highlightTimeoutId){
        clearTimeout(highlightTimeoutId);
        highlightTimeoutId = null;
      }

      var highlightHovered = item.isNode ? self.options.highlightHoveringNode : self.options.highlightHoveringLink;
      if(!highlightHovered || self._keepHighlighting) return;

      if(item.isNode) self.svg.select('#'+item.textId).text(item.shortTitle);

      self.unhighlightAll();
    }
  };

  Graph.prototype._bindItemClickingEvents = function(){
    var self = this;
    this.nodes.on('mouseup', function(node) {
      if(self._isDragged()) return false;

      if(self.options.highlightClickedNode)
        self.highlightNode(node.id, {keepHighlighting: true});

      if(self.options.centerClickedNode)
        self.centerItem(node.id);

      self._fire(Graph.Events.NODE_CLICK, [node]);
    });

    this.links.on('mouseup', function(link) {
      if(self._isDragged()) return false;

      if(self.options.highlightClickedLink)
        self.highlightLink(link.id, {keepHighlighting: true});

      if(self.options.centerClickedLink)
        self.centerItem(link.id);

      self._fire(Graph.Events.LINK_CLICK, [link]);
    });
  };

  Graph.prototype._bindZoomAndDragEvents = function(){
    var self = this;

    self.zoomBehavior
        .scale([self.options.zoomInitialScale])
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
      if(!self._isDragged()) self.unhighlightAll();
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

  Graph.prototype._isCenteringItem = function(){
    return this._centeringItem;
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

  Graph.prototype._bindResizeEvent = function(){
    var self = this;
    updatePositions();
    d3.select(window).on('resize.'+this.id, updatePositions);

    function updatePositions(){
      self.positions.svgWidth = parseInt(self.svg.style('width'));
      self.positions.svgHeight = parseInt(self.svg.style('height'));
      if(self._highlightedItem) self.centerItem(self._highlightedItem.id);
    }
  };

  function assignDefaultValues(data, idPrefix){
    data.styles = merge(DEFAULT_GLOBAL_STYLES, data.styles);

    var nodes = data.nodes;
    for(var i = 0; i < nodes.length; i++){
      var node = nodes[i];
      node.id = idPrefix+(node.id || i).toString();
      node.shown = true;
      node.isNode = true;
      var styles = merge(DEFAULT_NODE_STYLES, data.styles);
      node.styles = merge(styles, node.styles);
      _inheritStyle(node.styles, {
        'circleHighlightedFill': 'circleFill',
        'circleHighlightedStroke': 'circleStroke',
        'circleHighlightedStrokeWidth': 'circleStrokeWidth',
        'circleCenterFill': 'circleFill',
        'circleCenterStroke': 'circleStroke',
        'circleCenterStrokeWidth': 'circleStrokeWidth',
      });
    }

    var links = data.links;
    for(var j = 0; j < links.length; j++){
      var link = links[j];

      var sourceNode = nodes[link.source];
      var targetNode = nodes[link.target];
      link.id = idPrefix+(link.id || (sourceNode.id + '-' + targetNode.id));
      link.isNode = false;

      var styles = merge(DEFAULT_LINK_STYLES, data.styles);
      link.styles = merge(styles, link.styles);
      _inheritStyle(link.styles, {
        'lineHighlightedStroke': 'lineStroke',
        'lineCenterStroke': 'lineStroke',
      });
    }
  }

  function _inheritStyle(styles, names){
    for(var child in names){
      var parent = names[child];
      styles[child] = styles[child] || styles[parent];
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

  function scaleAttr(scale) {
    return 'scale('+scale+','+scale+')';
  }
})();
