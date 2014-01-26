(function( exports ) {

    // a utility method for merging objects (similar to underscore's _.extend() )
    var merge = function( obj ) {
        for ( var i = 1 ; i < arguments.length ; i ++ ) {
            for ( var name in arguments[ i ] ) {
                obj[ name ] = arguments[ i ][ name ];
            }
        }
        return obj;
    };

    // Blueprint
    var Blueprint = function Blueprint() {}
    Blueprint.prototype.init = function() {
        this.emit( "init" );
    };

    Blueprint.prototype.update = function( obj ) {
        return merge( this, obj );
    };

    Blueprint.prototype.toObject = function() {
        return merge( {}, this );
    };

    Blueprint.extend = function( name ) {
        this.emit( "extend:before", arguments );

        // create the named constructor
        var js = "function " + name + "(){this.init.apply(this,arguments)};";
        var ctor = eval( js + name );

        // most basic inheritance from the first parent
        // and then copy-prototype inheritence for every other parent
        var parents = [ this ];
        ctor.prototype = Object.create( parents[ 0 ].prototype );
        for ( var i = 1; i < arguments.length ; i += 1 ) {
            var proto = arguments[ i ];
            if ( typeof proto === "function" ) {
                parents.push( proto )
                proto = proto.prototype;
            }
            merge( ctor.prototype, proto );
        }

        // copy class members
        for ( var i = 0 ; i < parents.length ; i += 1 ) {
            merge( ctor, parents[ i ] );
        }

        // finally override the constructor setting to the first parent
        ctor.prototype.constructor = ctor;
        ctor.prototype.constructor.parents = parents;

        this.emit( "extend:after", ctor );
        return ctor;
    };

    /** Events **/
    Blueprint.Events = {
        on: function( type, callback ) {
            this._listeners || ( this._listeners = {} );
            this._listeners[ type ] || ( this._listeners[ type ] = [] );
            this._listeners[ type ].push( callback );
            return this;
        },

        off: function( type, callback ) {
            if ( !this._listeners ) return this;
            if ( !this._listeners[ type ] ) return this;

            var i = 0;
            while ( -1 !== ( i = this._listeners[ type ].indexOf( callback ) ) ) {
                this._listeners[ type ].splice( i, 1 );
            }
            return this;
        },

        emit: function( type ) {
            if ( !this._listeners ) return this;
            if ( !this._listeners[ type ] ) return this;

            var args = [].slice.call( arguments, 1 );
            for ( var i = 0 ; i < this._listeners[ type ].length ; i += 1 ) {
                this._listeners[ type ][ i ].apply( this, args );
            }
            return this;
        }
    };

    merge( Blueprint.prototype, Blueprint.Events );
    merge( Blueprint, Blueprint.Events );


    /** Model **/
    var Model = Blueprint.extend( "Model", {
        save: function() {
            console.log( this.constructor );
            return this.constructor.datastore().save( this );
        },
        load: function() {
            return this.constructor.datastore().load( this );
        },
        remove: function() {
            return this.constructor.datastore().remove( this );
        }
    });

    Model.find = function( criteria ) {
        return this.constructor.datastore().find( this.constructor, criteria );
    };

    Model.datastore = function( ds ) {
        if ( arguments.length == 0 ) {
            return this._datastore;
        }
        this._datastore = ds;
        return this;
    };

    /** Datastore **/
    var Datastore = Blueprint.extend( "Datastore", {
        init: function( map ) {
            this.map = map || {};
        },

        key: function( model ) {
            return model.constructor.name + "." + model.id;
        },

        save: function( model ) {
            this.map[ this.key( model ) ] = model.toObject();
            model.emit( "saved" );
            return model;
        },

        load: function( model ) {
            model.update( this.map[ this.key( model ) ] );
            model.emit( "loaded" );
            return model;
        },

        remove: function( model ) {
            delete this.map[ this.key( model ) ];
            model.emit( "removed" );
            return model;
        }
    });

    // export the Blueprint class
    exports.Blueprint = Blueprint
    exports.Model = Model
    exports.Datastore = Datastore

})( typeof exports === "undefined" ? this[ "blueprint" ] = {} : exports );