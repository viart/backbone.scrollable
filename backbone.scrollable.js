/**
 * Backbone.ScrollableView v0.0.1
 *
 * Documentation: https://github.com/viart/backbone.scrollable
 *
 * Artem Vitiuk (@avitiuk)
 */

!function($, _, Scroller, Backbone) {
    'use strict';

    var Scrollable = Backbone.View.extend({

        bodyEl: null,
        scroller: null,

        stickersSelector: '.sticky',

        options: {
            scrollingX: false,
            scrollingY: true,
            stickable: false
        },

        initialize: function (options) {
            _.extend(this.options, options);

            this.initSettings(options);
            this.on('rendered resized', this.updateScrollDimentions, this);
        },

        initSettings: function (options) {

            options = options || {};
            _.extend(this.options, options);

            this._stickers = {
                offsets: [],
                texts: [],
                height: 0
            };

            this._sticker = {
                el: null,
                pos: -1
            };
        },

        initScroller: function () {

            if (!this.bodyEl) {
                throw new Error('Scrollable body is missed.');
            }

            this.scroller = new Scroller(
                this._getScrollProcessor(),
                this.options
            );

            this.updateScrollDimensions();

            this.$('img').on('load', this.updateScrollDimensions);

            if ('ontouchstart' in window) {
                _.bindAll(this, '_onTouchStart', '_onTouchMove', '_onTouchStop', 'updateScrollDimensions');

                document.addEventListener('orientationchange', this.updateScrollDimensions, false);

                this.$el.on('touchstart', this._onTouchStart);
                $(document)
                    .on('touchmove', this._onTouchMove)
                    .on('touchend', this._onTouchStop)
                    .on('touchcancel', this._onTouchStop);
            } else {
                console.log(111);
                // Mouse events
                _.bindAll(this, '_onMouseDown', '_onMouseMove', '_onMouseStop');

                this.$el.on('mousedown', this._onMouseDown);
                $(document)
                    .on('mousemove', this._onMouseMove)
                    .on('mouseup', this._onMouseStop);
            }
        },

        updateScrollDimensions: function () {

            var that = this,
                offsetTop;

            if (!this.scroller) {
                return;
            }

            if (this.options.stickable) {
                this._sticker.el = this.$('.sticker').get(0);

                offsetTop = this.$el.outerHeight() - this.$el.innerHeight() + this.$el.offset().top;
                this._stickers.height = this.$(this.stickersSelector).each(function(){
                    var $el = $(this);
                    that._stickers.offsets.push($el.offset().top - offsetTop);
                    that._stickers.texts.push($el.text());
                }).height();
            }

            this.scroller.setDimensions(
                this.$el.outerWidth(true),
                this.$el.outerHeight(true),
                this.bodyEl.offsetWidth,
                this.bodyEl.offsetHeight
            );
        },

        refreshSticker: function (top, positionUpdater) {
            var offsets = this._stickers.offsets,
                texts = this._stickers.texts,
                height = this._stickers.height,
                current = -1,
                next;

            // Detect current position
            for (var i = offsets.length - 1; i >= 0; i--) {
                if (top > offsets[i]) {
                    current = i;
                    break;
                }
                next = i;
            }

            this._sticker.el.style.display = top > offsets[0] ? 'block' : 'none';

            if (top - offsets[current] > 0) {
                if (!next || top + height < offsets[next]) {
                    if (this._sticker.pos !== 0) {
                        this._sticker.pos = 0;
                        positionUpdater(0, this._sticker.pos, 1);
                    }
                }

                if (this._sticker.el.innerHTML !== texts[current]) {
                    this._sticker.el.innerHTML = texts[current];
                }
            }

            // update position (on the fast scrolling)
            if (next && top + height > offsets[next]) {
                this._sticker.pos = top + height - offsets[next];
                positionUpdater(0, this._sticker.pos, 1);
            }
        },

        _onTouchStart: function (e) {
            this.touched = e.target;
            this.scroller.doTouchStart(e.originalEvent.touches, e.timeStamp);
            e.preventDefault();
        },

        _onMouseDown: function (e) {
            if (e.target.tagName.match(/input|textarea|select/i)) {
                return;
            }

            this.scroller.doTouchStart([{pageX: e.pageX, pageY: e.pageY}], e.timeStamp);

            this.touched = true;
            e.preventDefault();
        },

        _onTouchMove: function (e) {
            this.touched = false;
            this.scroller.doTouchMove(e.originalEvent.touches, e.timeStamp);
        },

        _onMouseMove: function (e) {
            if (!this.touched) {
                return;
            }

            this.scroller.doTouchMove([{pageX: e.pageX, pageY: e.pageY}], e.timeStamp);
        },

        _onTouchStop: function (e) {
            this.scroller.doTouchEnd(e.timeStamp);
            // to prevent of losing Event listeners Click should be emulated on the Event's Target
            this._emulateClick();
        },

        _onMouseStop: function (e) {
            if (!this.touched) {
                return;
            }

            this.scroller.doTouchEnd(e.timeStamp);
            this.touched = false;
        },

        _emulateClick: function () {
            var evt;
            if (this.touched) {
                evt = document.createEvent('MouseEvents');
                evt.initMouseEvent('click', true, true, window, 1);
                this.touched.dispatchEvent(evt);
                this.touched = false;
            }
        },

        _getScrollProcessor: function () {
            var updater = this._getUpdater();
            if (this.options.stickable) {
                return _.bind(function (left, top) {
                    updater.apply(this.bodyEl, arguments);
                    this.refreshSticker(top, _.bind(updater, this._sticker.el));
                }, this);
            } else {
                return _.bind(updater, this.bodyEl);
            }
        },

        _getUpdater: function () {
            var vendorPrefix,
                perspectiveProperty,
                transformProperty,
                processor,
                docStyle = document.documentElement.style,
                helperElem = document.createElement('div');

            if ('opera' in window) {
                vendorPrefix = 'O';
            } else if ('MozAppearance' in docStyle) {
                vendorPrefix = 'Moz';
            } else if ('WebkitAppearance' in docStyle) {
                vendorPrefix = 'Webkit';
            } else if (typeof navigator.cpuClass === 'string') {
                vendorPrefix = 'ms';
            }

            perspectiveProperty = vendorPrefix + 'Perspective';
            transformProperty = vendorPrefix + 'Transform';

            if (perspectiveProperty in helperElem.style) {
                processor = function(left, top, zoom) {
                    this.style[transformProperty] = 'translate3d(' + (-left) + 'px,' + (-top) + 'px,0) scale(' + zoom + ')';
                };
            } else if (transformProperty in helperElem.style) {
                processor = function(left, top, zoom) {
                    this.style[transformProperty] = 'translate(' + (-left) + 'px,' + (-top) + 'px) scale(' + zoom + ')';
                };
            } else {
                processor = function(left, top, zoom) {
                    this.style.marginLeft = left ? (-left/zoom) + 'px' : '';
                    this.style.marginTop = top ? (-top/zoom) + 'px' : '';
                    this.style.zoom = zoom || '';
                };
            }

            return processor;
        },

        //FIXME: use dispose()
        close: function () {
            // remove event handlers
            if ('ontouchstart' in window) {
                document.removeEventListener('orientationchange', this.updateScrollDimensions, false);

                this.$el.off('touchstart', this._onTouchStart);
                $(document)
                    .off('touchmove', this._onTouchMove)
                    .off('touchend', this._onTouchStop)
                    .off('touchcancel', this._onTouchStop);
            } else {
                this.$el.off('mousedown', this._onMouseDown);
                $(document)
                    .off('mousemove', this._onMouseMove)
                    .off('mouseup', this._onMouseStop);

            }
            this.$('img').off('load', this.updateScrollDimensions);

            Backbone.View.prototype.close.apply(this, arguments);
        }
    });

    // Register as a named module with AMD.
    if (typeof define === 'function' && define.amd) {
        define('backbone.scrollable', [], function() { return Scrollable; });
    }

    // Integrate with Backbone.js.
    Backbone.ScrollableView = Scrollable;

}(jQuery, _, Scroller, Backbone);



