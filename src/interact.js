(function ($) {
  "use strict";

  var interact = $.interact = function (rootElement, debug) {
    
    var $rootElement = $(rootElement);
    var document = rootElement.nodeType === 9 ? rootElement : rootElement.ownerDocument;
    var isMac = navigator.userAgent.indexOf('Mac OS X') != -1;

    var log = function () {
      if (!debug) {
        return;
      }

      console.log.apply(console, arguments);
    };

    var isCommandPressed = function (evt) {
      var command = isMac && evt.metaKey;
      var ctrl = !isMac && evt.ctrlKey;
      
      return ctrl || command;
    };

    //////////////////////
    // marking elements //
    //////////////////////

    var MARKER_CLASSES = ['interact-marker'];

    /**
     * These are the marked elements of the rootElement.
     *
     * @var Array.<Node>
     */
    var markedElements = [];

    var $markerContainer = $('<div class="interact-marker-container"></div>');

    /**
     * Gets the first focusable element in the chain or the correct rootElement
     *
     * @param {jQuery} $elements The elements for which the parent is searched
     * @returns {jQuery} a single element     
     */
    var getFocusParent = function ($elements) {
      var $importantRootElement = $rootElement.has($elements);
      if ($importantRootElement.length !== 1) {
        console.error("wrong number of rootElements for", $elements, $focusParent);
        throw new Error("wrong number of rootElements");
      }

      var $focusParent = $elements.closest('[tabindex]', $importantRootElement[0]);
      if ($focusParent.length === 0) {
        $focusParent = $importantRootElement;
      }
      if ($focusParent.length !== 1) {
        console.error("wrong number of focus parents for", $elements, $focusParent);
        throw new Error("wrong number of focus parents");
      }
      
      return $focusParent;
    };

    /**
     * Gets an array of marked elements from a focusParent element.
     * 
     * @param {jQuery} $focusParent
     * @returns {jQuery} All marked elements
     */
    var getMarkedElements = function ($focusParent) {
      return $focusParent.find('.' + MARKER_CLASSES.join('.'));
    };

    var removeMarking = function ($elements) {
      $elements.removeClass(MARKER_CLASSES.join(' '));
    };

    var addMarking = function ($elements) {
      $elements.addClass(MARKER_CLASSES.join(' '));
    };

    $rootElement.on('mousedown.interact.marker', '[draggable]', function (evt) {
      var $draggable = $(this);
      var commandPressed = isCommandPressed(evt);
      var isActive = $draggable.hasClass(MARKER_CLASSES.join(' '));

      log("mouse mark", this, evt, commandPressed, isActive);

      if (isActive && ! commandPressed) {
        return;
      }

      if (commandPressed) {
        if (isActive) {
          removeMarking($draggable);
        } else {
          addMarking($draggable);
        }
      } else {
        var $focusParent = getFocusParent($draggable);
        var $markedElements = getMarkedElements($focusParent);
        $markedElements.not($draggable).removeClass(MARKER_CLASSES.join(' '));
        addMarking($draggable);
      }

      evt.preventDefault();
    });

    $rootElement.on('mousedown.interact.marker', '.' + MARKER_CLASSES.join('.'), function (evt) {
      if (evt.isDefaultPrevented()) {
        return;
      }

      var $this = $(this);
      var timeout = null;

      var stopTimeout = function () {
        clearTimeout(timeout);
      };

      timeout = setTimeout(function () {
        var $focusParent = getFocusParent($(evt.target));
        var $markedElements = getMarkedElements($focusParent);
        $markedElements.not($this).removeClass(MARKER_CLASSES.join(' '));
        $rootElement.off('.interact.marker.tmp', stopTimeout)
      }, 600);

      var events = 'mousedown.interact.marker.tmp dragstart.interact.marker.tmp';
      $rootElement.one(events, stopTimeout);
    });

    $rootElement.on('mousedown.interact.marker', function (evt) {
      if ($(evt.target).is('[draggable], [draggable] *')) {
        return;
      }

      var $focusParent = getFocusParent($(evt.target));
      var $markedElements = getMarkedElements($focusParent);
      $markedElements.removeClass(MARKER_CLASSES.join(' '));
    });



    ///////////////////////////////////
    // parsing of mimeType and value //
    ///////////////////////////////////

    var RX_TYPE_REPLACE = /[A-Z]/g;
    var RX_TYPE_REPLACE_CB = function (value) {
      return '-' + value.toLowerCase();
    };

    var parseType = function (value) {
      return value.replace(RX_TYPE_REPLACE, RX_TYPE_REPLACE_CB).replace('-', '/');
    };

    var parseValue = function (value) {
      switch (value) {
        default: return String(value);
      }
    };

    /////////////////
    // DRAG & DROP //
    /////////////////

    var DRAG_EFFECTS = {
      'copy': 'copy',
      'move': 'move',
      'copy|move': 'copyMove',
      // following effects aren't directly supported as of now
      'link': 'link',
      'link|move': 'linkMove',
      'copy|link': 'copyLink',
      'copy|link|move': 'all'
    };

    var DND_EVENTS = 'dragstart dragenter dragover dragleave drop dragend'.split(' ');

    var dndHooks =  {
      props: ['dataTransfer'],
      filter: function (event, original) {
        if (event.dataTransfer == null) {
          event.dataTransfer = {};
        }

        var dummyDataTransfer = {
          dropEffect: 'none',
          effectAllowed: 'all',
          files: [],
          items: [],
          types: [],
          setData: $.noop,
          getData: $.noop,
          clearData: $.noop,
          setDragImage: $.noop
        };
        $.each(dummyDataTransfer, function (key, value) {
          if (event.dataTransfer[key] == null) {
            event.dataTransfer[key] = value;
          }
        });

        return event;
      } 
    };

    // add event fix for all drag&drop events
    $.each(DND_EVENTS, function (index, event) {
      $.event.fixHooks[event] = dndHooks;
    });

    $rootElement.on('dragstart.interact.dnd', '[draggable]', function (evt) {
      var $this = $(this);
      var $focusParent = getFocusParent($this);
      var $markedElements = getMarkedElements($focusParent);
      
      // gather all data to be added
      var data = {};
      $markedElements.each(function () {
        var $this = $(this);

        var elementData = $this.data();
        elementData['text-x-html'] = this.outerHTML;

        $.each(elementData, function (type, value) {
          var mimeType = parseType(type);
          var value = parseValue(value);

          if (typeof data[mimeType] !== 'string') {
            data[mimeType] = value;
          } else {
            data[mimeType] += '\n' + value;
          }
        });
      });

      // insert all data to the transfer
      log("setData", data);
      $.each(data, function (mimeType, value) {
        evt.dataTransfer.setData(mimeType, value);
      });

      // also tell that only copy and move is possible
      evt.dataTransfer.effectAllowed = 'copyMove';
    });

    $rootElement.on('dragover.interact.dnd', '[data-dropzone]', function (evt) {
      var $this = $(this);
      
      // XXX define a way to allow other types
      var data = evt.dataTransfer.getData('text/x-html');
      if (data == null) {
        return;
      }

      evt.preventDefault();
    });

    $rootElement.on('drop.interact.dnd', '[data-dropzone]', function (evt) {
      var $this = $(this);
     
      // XXX add posibility to add other types
      var data = evt.dataTransfer.getData('text/x-html');
      if (data == null) {
        return;
      }

      var append = null;
      append = $.parseHTML(data, document);
     
      if (append != null) {
        evt.preventDefault();
        $this.append(append);
      }
    });

    $rootElement.on('dragend.interact.dnd', '[draggable]', function (evt) {
        var $this = $(this);
        var $focusParent = getFocusParent($this);
        var $markedElements = getMarkedElements($focusParent);
      
        $markedElements.each(function () {
          var $markedElement = $(this);

          var event = jQuery.Event('drag-cleanup');
          $markedElement.trigger(event);
          if (event.isDefaultPrevented()) {
            return;
          }

          if (evt.dataTransfer.dropEffect === 'move') {
            $markedElement.remove();
          }
        });
    });
  };

})(jQuery); 
