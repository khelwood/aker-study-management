(function($, undefined) {
  /***************
  * OrgChartTree *
  * **************/
  /**
  * This is the main class that provides the functionality for using a hierarchical tree with
  * the library orgchart.js https://github.com/dabeng/OrgChart with MIT license.
  * 
  **/
  function OrgChartTree() {
    // At instantiation time, calls the initialization method for each composed module
    // as defined afterwards
    MODULES.forEach($.proxy(function(module) {
      module.apply(this, arguments);
    }, this));
  };

  // To be able to access it from other places on Javascript runtime (global definition)
  window.OrgChartTree = OrgChartTree;

  // Modules that will compose this class
  var MODULES = [
    OrgChartMenu,        // UI to create, modify and remove some nodes
    OrgChartStatus,      // Behavioral methods to keep the local copy of the tree up to date with server
    OrgChartIconChildren // Bugfix/Workaround: Small modification of default behaviour to display children icon
  ];

  // Composes this class with the modules
  OrgChartTree.prototype = $.extend.apply(this, $.map(MODULES, function(mod) { return mod.prototype; }));

  // We'll use the prototype of the class to add more methods, in this case the related ones with the
  // OrgCharTree functionality
  var proto = OrgChartTree.prototype;


  // loadTree()
  //
  // Arguments: None
  // Returns: $.Deferred promise
  // 
  // Performs an ajax call to the Study app that will obtain all nodes from the tree. 
  // The tree json structure will then be created from the answer by:
  // 1. Use TreeBuilder helper class to transform this answer in a valid JS object that the
  // orgchart can understand
  // 2. Create and display the tree itself by using this JS object
  // helper class 
  // 3. Attach the event handlers related with the interaction with the tree itself when:
  //  - 3.1 Select/Deselect a node
  //  - 3.2 Check that the node we want to drop can be dropped
  //  - 3.3 Drop a node on another node
  //  
  // The value returned by loadTreee() is a promise that will be resolved successfully if 
  // all these tasks have occured successfully
  proto.loadTree = function() {
    var defer = $.Deferred(); // Returned value
    var self = this;
    return $.get('/api/v1/nodes?include=nodes.parent', $.proxy(function(response) {
      // Remove the previous display of the tree (if there is one)
      $('#tree-hierarchy').html('');

      $('#tree-hierarchy').orgchart({
        // Extracts the nodes structure from the Ajax response, and creates a valid JS for orgchart
        'data' : TreeBuilder.createFrom(response.data, true)[0],
        // Max depth to show
        'depth': response.data.length,
        // Custom attribute that we'll use on node creation to set some info inside the created nodes
        // of the tree
        'nodeContent': 'cost_code',
        'nodeID': 'id',
        // The box that contains the tree can be traversed by pulling
        'draggable' : true,
        // No zoom allowed
        'pan': false,
        // Callback function called every time a node is created
        createNode: $.proxy(this.createTreeNode, this),
        // Condition to check before being able to drop a node on another one. It will identify a valid
        // droppable node
        dropCriteria: $.proxy(this.onBeforeDrop, this)
      })
      // Deselect selected node
      .on('click', '.orgchart', $.proxy(this.onClickOnTree, this))
      .children('.orgchart')
      // Callback function when a node is actually dropped on another
      .on('nodedropped.orgchart', $.proxy(this.onDrop, this));
      // Resolves the promise as successful (no exceptions up to this point)
      defer.resolve(true);
    }, this));

    // Returns a promise not resolved yet (this will happen when the Ajax response provided to the $.get
    // has occured)
    return defer;
  };

  // onBeforeDrop()
  //
  // Arguments: None
  // Returns: Boolean
  //  
  // This function is the dropCriteria of the tree. It will be fired when the user indicates that want to
  // link two nodes A (parent) and B (child) by dropping node A on node B. When this happens, onBeforeDrop
  // will perform a validation check to detect if both nodes are compatible to be link together as 
  // parent -> child.
  // The actual condition checks that we are not trying to add as a child of another node the actual root 
  // node of the tree (identified by id=1)
  // Returns true if the node can be dropped, or false if it can't
  proto.onBeforeDrop = function($draggedNode, $dragZone, $dropZone) {
    // Gets the node ids (an integer) for the dropped and dragged nodes from the URL of the node
    var dropNodeID = $dropZone.children('.content').text().split("/")[2];
    var draggedNodeID = $draggedNode.children('.content').text().split("/")[2];

    // adds drag and drop restrictions
    // ID 1 is the root node
    return (dropNodeID != 1);
  };

  // onDrop
  // 
  // Arguments:
  // - event : Event generated by the Dropzone library with info about the drag/drop interaction
  // Returns: jQuery AJAX promise with the result of the Ajax call performed to link both nodes
  //
  // This method obtains from the study application the current information from the server for the destination 
  // node (the parent node where we are dropping the child) and on receiving that answer it will call the 
  // updateNode method to update the information in the server with the info provided by the Dropzone event
  // If we AJAX call to the server for the parent node fails, it will perform the handler onErrorConnection
  // It returns the promise indicating if the action was successful
  proto.onDrop = function(event) {
    $.get('/api/v1/nodes/'+event.dropZone[0].id, $.proxy(function(response) {
      this.updateNode(response.data.id, event);
    }, this)).fail($.proxy(this.onErrorConnection, this));
  };

  // onClickOnTree
  //
  // Arguments: DOM click event
  // Returns: None
  //
  // Deselect selected node, possibly.
  proto.onClickOnTree = function(event) {
    if (!$(event.target).closest('.node').length) {
      this.resetStatusMenu();
    }
  };

  // selectedNode()
  // 
  // Arguments: None
  // Returns DOM node
  // 
  // Returns the DOM node of the node already selected in the tree
  proto.selectedNode = function() {
    return $('#selected-node').data('node');
  };

  
  proto.selectNode = function(node) {
    $('#selected-node').val(node.attr('title')).data('node', node);
  };

  proto.unselectNode = function() {
    $('#selected-node').data('node', null);
    $('#selected-node').val('');
  };

  proto.createTreeNode = function($node, data) {
    this.unselectNode();
    this.resetStatusMenu();
    $node.attr('title', data.name);
    $node.attr('id', data.id);
    $node.on('click', $.proxy(function(event) {
      if (!$(event.target).is('.edge')) {
        this.selectNode($node);
        //$('#edit-panel').css('visibility', 'visible');
        $('#edit-panel button').prop('disabled', false);
        $('#edit-panel input').prop('disabled', false);
        $('#btn-delete-nodes').prop('disabled', this.hasChildren($node));
      }
    }, this));

    $node.on('dblclick', $.proxy(this.onUpdateNodes, this, $node));
    return($node);
  };

  // Determine whether parent has any children (based on its colspan???)
  proto.hasChildren = function (node) {
    return node.parent().attr('colspan') > 0 ? true : false;
  };

}(jQuery));