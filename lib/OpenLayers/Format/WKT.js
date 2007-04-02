/* Copyright (c) 2006 MetaCarta, Inc., published under a modified BSD license.
 * See http://svn.openlayers.org/trunk/openlayers/repository-license.txt 
 * for the full text of the license. */

/**
 * Read and write WKT. 
 * @requires OpenLayers/Format/JSON.js
 */
OpenLayers.Format.WKT = OpenLayers.Class.create();
OpenLayers.Format.WKT.prototype = 
  OpenLayers.Class.inherit(OpenLayers.Format, {
    
    /**
     *
     */
    initialize: function(options) {
        this.regExes = {
            'typeStr': /^\s*(\w+)\s*\(\s*(.*)\s*\)\s*$/,
            'spaces': /\s+/,
            'parenComma': /\)\s*,\s*\(/,
            'doubleParenComma': /\)\s*\)\s*,\s*\(\s*\(/,  // can't use {2} here
            'trimParens': /^\s*\(?(.*?)\)?\s*$/
        };
        OpenLayers.Format.prototype.initialize.apply(this, [options]);
    },

    /**
     * Deserialize a WKT string and return an OpenLayers.Geometry or an array
     * of OpenLayers.Geometry.  Supports WKT for POINT, MULTIPOINT, LINESTRING,
     * MULTILINESTRING, POLYGON, MULTIPOLYGON, and GEOMETRYCOLLECTION.
     * @param {String} wkt A WKT string
     * @returns {OpenLayers.Geometry|Array} A geometry or array of geometries
     *                                      for GEOMETRYCOLLECTION WKT.
     */
    read: function(wkt) {
        var geometry, type, str;
        var matches = this.regExes.typeStr.exec(wkt);
        if(matches) {
            type = matches[1].toLowerCase();
            str = matches[2];
            if(this.parse[type]) {
                geometry = this.parse[type].apply(this, [str]);
            }
        }
        return geometry;
    },

    /**
     * Serialize a geometry or array of geometries into a WKT string.
     * @param {OpenLayers.Geometry|Array} geom A geometry or array of geometries
     * @returns {String} The WKT string representation of the input geometries
     */
    write: function(geom) {
        var collection, geometry, type, data, isCollection;
        if(geom.constructor == Array) {
            collection = geom;
            isCollection = true;
        } else {
            collection = [geom];
            isCollection = false;
        }
        var pieces = [];
        if(isCollection) {
            pieces.push('GEOMETRYCOLLECTION(');
        }
        for(var i=0; i<collection.length; ++i) {
            if(isCollection && i>0) {
                pieces.push(',');
            }
            geometry = collection[i];
            type = geometry.CLASS_NAME.split('.')[2].toLowerCase();
            if(!this.extract[type]) {
                return null;
            }
            data = this.extract[type].apply(this, [geometry]);
            pieces.push(type.toUpperCase() + '(' + data + ')');
        }
        if(isCollection) {
            pieces.push(')');
        }
        return pieces.join('');
    },
    
    /**
     * Object with properties corresponding to the geometry types.
     * Property values are functions that do the actual data extraction.
     */
    extract: {
        /**
         * Return a space delimited string of point coordinates.
         * @param {OpenLayers.Geometry.Point} point
         * @returns {String} A string of coordinates representing the point
         */
        'point': function(point) {
            return point.x + ' ' + point.y;
        },

        /**
         * Return a comma delimited string of point coordinates from a multipoint.
         * @param {OpenLayers.Geometry.MultiPoint} multipoint
         * @returns {String} A string of point coordinate strings representing
         *                  the multipoint
         */
        'multipoint': function(multipoint) {
            var array = [];
            for(var i=0; i<multipoint.components.length; ++i) {
                array.push(this.extract.point.apply(this, [multipoint.components[i]]));
            }
            return array.join(',');
        },
        
        /**
         * Return a comma delimited string of point coordinates from a line.
         * @param {OpenLayers.Geometry.LineString} linestring
         * @returns {String} A string of point coordinate strings representing
         *                  the linestring
         */
        'linestring': function(linestring) {
            var array = [];
            for(var i=0; i<linestring.components.length; ++i) {
                array.push(this.extract.point.apply(this, [linestring.components[i]]));
            }
            return array.join(',');
        },

        /**
         * Return a comma delimited string of linestring strings from a multilinestring.
         * @param {OpenLayers.Geometry.MultiLineString} multilinestring
         * @returns {String} A string of of linestring strings representing
         *                  the multilinestring
         */
        'multilinestring': function(multilinestring) {
            var array = [];
            for(var i=0; i<multilinestring.components.length; ++i) {
                array.push('(' +
                           this.extract.linestring.apply(this, [multilinestring.components[i]]) +
                           ')');
            }
            return array.join(',');
        },
        
        /**
         * Return a comma delimited string of linear ring arrays from a polygon.
         * @param {OpenLayers.Geometry.Polygon} polygon
         * @returns {String} An array of linear ring arrays representing the polygon
         */
        'polygon': function(polygon) {
            var array = [];
            for(var i=0; i<polygon.components.length; ++i) {
                array.push('(' +
                           this.extract.linestring.apply(this, [polygon.components[i]]) +
                           ')');
            }
            return array.join(',');
        },

        /**
         * Return an array of polygon arrays from a multipolygon.
         * @param {OpenLayers.Geometry.MultiPolygon} multipolygon
         * @returns {Array} An array of polygon arrays representing
         *                  the multipolygon
         */
        'multipolygon': function(multipolygon) {
            var array = [];
            for(var i=0; i<multipolygon.components.length; ++i) {
                array.push('(' +
                           this.extract.polygon.apply(this, [multipolygon.components[i]]) +
                           ')');
            }
            return array.join(',');
        }

    },

    /**
     * Object with properties corresponding to the geometry types.
     * Property values are functions that do the actual parsing.
     */
    parse: {
        /**
         * Return point geometry given a point WKT fragment.
         * @param {String} str A WKT fragment representing the point
         * @returns {OpenLayers.Geometry.Point} A point geometry
         */
        'point': function(str) {
            var coords = str.trim().split(this.regExes.spaces);
            return new OpenLayers.Geometry.Point(coords[0], coords[1]);
        },

        /**
         * Return a multipoint geometry given a multipoint WKT fragment.
         * @param {String} A WKT fragment representing the multipoint
         * @returns {OpenLayers.Geometry.MultiPoint} A multipoint geometry
         */
        'multipoint': function(str) {
            var points = str.trim().split(',');
            var components = [];
            for(var i=0; i<points.length; ++i) {
                components.push(this.parse.point.apply(this, [points[i]]));
            }
            return new OpenLayers.Geometry.MultiPoint(components);
        },
        
        /**
         * Return a linestring geometry given a linestring WKT fragment.
         * @param {String} A WKT fragment representing the linestring
         * @returns {OpenLayers.Geometry.LineString} A linestring geometry
         */
        'linestring': function(str) {
            var points = str.trim().split(',');
            var components = [];
            for(var i=0; i<points.length; ++i) {
                components.push(this.parse.point.apply(this, [points[i]]));
            }
            return new OpenLayers.Geometry.LineString(components);
        },

        /**
         * Return a multilinestring geometry given a multilinestring WKT fragment.
         * @param {String} A WKT fragment representing the multilinestring
         * @returns {OpenLayers.Geometry.LineString} A multilinestring geometry
         */
        'multilinestring': function(str) {
            var line;
            var lines = str.trim().split(this.regExes.parenComma);
            var components = [];
            for(var i=0; i<lines.length; ++i) {
                line = lines[i].replace(this.regExes.trimParens, '$1');
                components.push(this.parse.linestring.apply(this, [line]));
            }
            return new OpenLayers.Geometry.MultiLineString(components);
        },
        
        /**
         * Return a polygon geometry given a polygon WKT fragment.
         * @param {String} A WKT fragment representing the polygon
         * @returns {OpenLayers.Geometry.Polygon} A polygon geometry
         */
        'polygon': function(str) {
            var ring, linestring, linearring;
            var rings = str.trim().split(this.regExes.parenComma);
            var components = [];
            for(var i=0; i<rings.length; ++i) {
                ring = rings[i].replace(this.regExes.trimParens, '$1');
                linestring = this.parse.linestring.apply(this, [ring]);
                linearring  = new OpenLayers.Geometry.LinearRing(linestring.components);
                components.push(linearring);
            }
            return new OpenLayers.Geometry.Polygon(components);
        },

        /**
         * Return a multipolygon geometry given a multipolygon WKT fragment.
         * @param {String} A WKT fragment representing the multipolygon
         * @returns {OpenLayers.Geometry.MultiPolygon} A multipolygon geometry
         */
        'multipolygon': function(str) {
            var polygon;
            var polygons = str.trim().split(this.regExes.doubleParenComma);
            var components = [];
            for(var i=0; i<polygons.length; ++i) {
                polygon = polygons[i].replace(this.regExes.trimParens, '$1');
                components.push(this.parse.polygon.apply(this, [polygon]));
            }
            return new OpenLayers.Geometry.MultiPolygon(components);
        },

        /**
         * Return an array of geometries given a geometrycollection WKT fragment.
         * @param {String} A WKT fragment representing the geometrycollection
         * @returns {Array} An array of OpenLayers.Geometry
         */
        'geometrycollection': function(str) {
            // separate components of the collection with |
            str = str.replace(/,\s*([A-Za-z])/g, '|$1');
            var wktArray = str.trim().split('|');
            var components = [];
            for(var i=0; i<wktArray.length; ++i) {
                components.push(OpenLayers.Format.WKT.prototype.read.apply(this,[wktArray[i]]));
            }
            return components;
        }

    },

    /** @final @type String */
    CLASS_NAME: "OpenLayers.Format.WKT" 

});     