(function() {

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
    var Blueprint = function() {}
    Blueprint.prototype.init = function() {
        this.emit( "init" );
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
    Blueprint.Model = Blueprint.extend( "Model", {
        save: function() {
            var ds = this.datastore();
            ds.save.apply( ds, this, arguments );
            return this;
        },

        find: function() {
            var ds = this.datastore();
            ds.find.apply( ds, this, arguments );
            return this;
        },

        remove: function() {
            var ds = this.datastore();
            ds.remove.apply( ds, this, arguments );
            return this;
        }
    });

    /** Datastore **/
    Blueprint.Datastore = Blueprint.extend( "Datastore", {
        save: function( model ) {
            throw new Error( "Not implemented" );
        },

        find: function( model ) {
            throw new Error( "Not implemented" );
        },

        remove: function( model ) {
            throw new Error( "Not implemented" );
        }
    });

    // export for both server and client
    if ( "undefined" != typeof window ) {
        window.Blueprint = Blueprint
    } else if ( module ) {
        module.exports = Blueprint
    }
    return Blueprint;

}())