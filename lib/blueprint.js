/*
 * Blueprint
 */

var extend = function( obj, var_args ) {
    for ( var i = 1; i < arguments.length ; i += 1 ) {
        var other = arguments[ i ];
        for ( var p in other ) {
            var v = Object.getOwnPropertyDescriptor( other, p );
            if ( typeof v != "undefined" ) {
                Object.defineProperty( obj, p, v );
            }
        }
    }
    return obj;
};

var blueprint = function() {
    return {
        configure: function( fn ) { fn.apply( this ); return this; },
    }
}

var Core = blueprint()
    .configure(function() {
        this.ctor = function() {};
        this.ctor.xname = "Core";
        this.directive = function( name, fn ) {
            this[ name ] = fn;
            return this;
        }

        this.__decorators = [];
        this.apply_decorators = function( name, value ) {
            while ( this.__decorators.length ) {
                value = this.__decorators.shift().call( this, name, value )
            }
            return value;
        }
    })

    .directive( "decorate", function( name, decorator ) {
        if ( typeof name == "function" && arguments.length == 1 ) {
            decorator = name;
            name = undefined;
        }
        decorator = this.apply_decorators( name, decorator );
        var decoration = function() {
            var fn = decorator.apply( this, arguments );
            this.__decorators.push( fn );
            return this;
        }
        decoration.decorator = decorator;

        if ( typeof name == "undefined" ) {
            return decoration(); // apply the decoration in-place
        }

        this[ name ] = decoration; // define a new decorator
        return this;
    })

    .directive( "directive", function( name, fn ) {
        fn = this.apply_decorators( name, fn );
        this[ name ] = fn;
        return this;
    })

    .decorate( "static", function() {
        this.__static = true;
        return function( name, value ) {
            return value;
        }
    })

    /** augments a method by adding properties to it's prototype, thus
    allowing it to access additional properties that are not accessible
    outside of it **/
    .decorate( "augment", function( with_ ) {
        return function( name, fn ) {
            if ( typeof fn != "function" ) 
                throw TypeError( "'augment' expecting function" )

            return function() {
                var aug = ( typeof with_ == "function" ) 
                    ? with_.apply( this ) 
                    : with_;

                var proto = Object.getPrototypeOf( this );
                var old = {};

                // add the new properties to the prototype
                for ( var p in aug ) {
                    old[ p ] = Object.getOwnPropertyDescriptor( proto, p );
                    var value = Object.getOwnPropertyDescriptor( aug, p );
                    Object.defineProperty( proto, p, value );
                }

                // run the function
                var rv = fn.apply( this, arguments );

                // revert back to the original prototype
                for ( var p in old ) {
                    if ( typeof old[ p ] == "undefined" ) {
                        delete proto[ p ];
                    } else {
                        Object.defineProperty( proto, p, old[ p ] );
                    }
                }

                return rv;
            }
        }
    })

    .directive( "define", function( name, value ) {
        var that = this;
        this.__augment || ( this.__augment = {} );
        value = this.apply_decorators( name, value )
        var obj = this.ctor.prototype;
        if ( this.__static ) {
            delete this.__static;
            obj = this.ctor;
        }

        if ( typeof value == "function" ) {
            value = this.augment.decorator(function() {
                var proto = Object.getPrototypeOf( this );
                var parent = Object.getPrototypeOf( proto );
                return extend( { super: parent[ name ] }, that.__augment );
            })( name, value )
        }

        obj[ name ] = value;
        this.ctor.trigger( "define", { name: name, value: value, obj: obj } );
        return this;
    })

    /** EVENTS **/
    .static()
    .define( "trigger", function( name ) {
        if ( this.__events && this.__events[ name ] ) {
            // clone the list of listeners in order to allow them to modify
            // the original list of callbacks
            var listeners = [].concat( this.__events[ name ] );
            for ( var i = 0 ; i < listeners.length ; i += 1 ) {
                listeners[ i ].apply( this, arguments );
            }
        }
        return this;
    })

    .static()
    .define( "on", function( name, fn ) {
        this.__events || ( this.__events = {} );
        this.__events[ name ] || ( this.__events[ name ] = [] );

        // avoid duplicates
        if ( this.__events[ name ].indexOf( fn ) != -1 ) return this;
        this.__events[ name ].push( fn )
        return this;
    })

    .static()
    .define( "off", function( name, fn ) {
        if ( !name ) {
            delete this.__events;
            return this;
        } else if ( !this.__events[ name ] ){
            return this;
        } else if ( !fn ) {
            delete this.__events[ name ];
            return this;
        } else {
            var i = this.__events[ name ].indexOf( fn );
            if ( i != -1 ) {
                this.__events[ name ].splice( i, 1 );
            }
            return this;
        }
    })

    .configure(function() {
        this.ctor.prototype.trigger = this.ctor.trigger;
        this.ctor.prototype.on = this.ctor.on;
        this.ctor.prototype.off = this.ctor.off;

        // prevent copying the the events from the parent class to the subclass
        this.ctor.on( "extend", function( ev, subcls ) {
            delete this.__events;
            subcls.on( "extend", arguments.callee );
        })
    })

    /** STATICS **/
    .decorate( "bind", function( to ) {
        return function( name, fn ) {
            if ( typeof fn != "function" ) {
                throw new Error( "'bind' decorator is only applicable to functions" )
            }

            var that = this;
            return function() {
                var _to = ( typeof to == "function" ) ? to.apply( that ) : to;
                return fn.apply( _to, arguments );
            }
        }
    })

    .bind( function() { return this } )
    .static()
    .define( "blueprint", function() {
        return this;
    })

    .static()
    .define( "extend", function( name ) {
        var ctor = extend( function() {
            ctor.trigger( "new", this );
            if ( this.init ) {
                this.init.apply( this, arguments );
            }
        }, this );

        if ( name ) {
            ctor.xname = name;
        }

        ctor.prototype = Object.create( this.prototype );
        ctor.prototype.constructor = ctor;
        var subcls = extend( Object.create( this.blueprint() ), { 
            ctor: ctor, 
            super: this 
        })
        this.trigger( "extend", ctor );
        return subcls;
    })

    /** PRIVATE **/
    .decorate( "private", function() {
        var that = this;
        this.ctor.on( "define", function( ev, opts ) {
            this.off( "define", arguments.callee );
            var name = opts.name, obj = opts.obj;
            var value = Object.getOwnPropertyDescriptor( obj, name );
            delete obj[ name ];
            Object.defineProperty( that.__augment, name, value );
            opts.obj = that.__augment;
        });

        return function( name, value ) {
            return value;
        }
    })

    .configure(function() {
        this.decorate( "private", function() {
            if ( !classes.find( this.ctor ) ) {
                classes.add( this.ctor );
                this.ctor.on( "create", on_create );
            }

            // prevent external access to private properties
            this.ctor.on( "define", function( ev, opts ) {
                this.off( "define", arguments.callee );
                var name = opts.name, obj = opts.obj;
                var value = Object.getOwnPropertyDescriptor( obj, name );
                var err = "Can't access private property '" + name + "'";
                Object.defineProperty( obj, name, {
                    get: function() { throw new Error( err ) },
                    set: function() { throw new Error( err ) }
                });
                classes.find( this ).privates[ name ] = value;
            });

            return function( name, value ) {
                return value;
            }
        });

        var on_create = function() {
            var cls = classes.find( this );
            wrap_obj( this.prototype, cls.privates );
        };

        var wrap_obj = function( obj, privates ) {
            for ( var p in obj ) {
                var v = Object.getOwnPropertyDescriptor( obj, p )
                if ( !v || typeof v.value != "function" ) continue;
                v = v.value;
                if ( v.original ) v = v.original;
                obj[ p ] = wrap( v, privates )
            }
            return obj;
        }

        var wrap = function( fn, privates ) {
            return extend(function() {
                var proto = Object.getPrototypeOf( this, proto );
                var old = {};

                // replace the object prototype with the private properties
                for ( name in privates ) {
                    old[ name ] = Object.getOwnPropertyDescriptor( proto, name );
                    Object.defineProperty( proto, name, privates[ name ] );
                }

                var rv = fn.apply( this, arguments );

                // revert back to the previous prototype
                var modified = {};
                for ( name in privates ) {
                    if ( typeof old[ name ] != "undefined" ) {
                        Object.defineProperty( proto, name, old[ name ] );
                    }
                    if ( this.hasOwnProperty( name ) ) {
                        var v = Object.getOwnPropertyDescriptor( this, name );
                        modified[ name ] = v;
                        delete this[ name ];
                    }
                }

                // private properties were modified for this instance
                if ( Object.keys( modified ).length ) {
                    modified = extend( {}, privates, modified );
                    wrap_obj( proto, modified );
                }

                return rv;
            }, { original: fn } );
        };

        var classes = extend([], {
            find: function( ctor ) {
                return this.filter(function( cls ) { 
                    return cls.ctor == ctor 
                })[ 0 ];
            },
            add: function( ctor ) {
                this.push({
                    ctor: ctor,
                    privates: {}
                })
            }
        });
    })

    /** PROPERTY **/
    .decorate( "property", function() {
        var that = this;
        this.ctor.on( "define", function( ev, opts ) {
            this.off( "define", arguments.callee );
            var name = opts.name, value = opts.value, obj = opts.obj;
            Object.defineProperty( obj, name, {
                get: function() { return value.call( this ) },
                set: function( v ) { value.call( this, v ) }
            });
        });

        return function( name, value ) {
            return value;
        }
    })

    /** PROMISES **/
    .decorate( "promise", function() {
        return function( name, fn ) {
            return function() {
                var args = [].concat( arguments );
                var that = this;
                return new Promise(function( fulfill, reject ) {
                    args.push( fulfill, reject )
                    fn.apply( that, args );
                })
            }
        }
    })

    .configure(function() {
        var last_define = null;
        this.ctor.on( "define", function( ev, value ) {
            last_define = value;
        });
        
        this.directive( "then", function( fn ) {
            var prev = last_define.value
            last_define.value = function() {
                var that = this;
                var rv = prev.apply( this, arguments );
                return rv.then(function( fulfill, reject ) {
                    return fn.call( that, this, fulfill, reject );
                })
            }
            last_define.obj[ last_define.name ] = last_define.value;
            return this;
        })
    })

    .directive( "init", function( fn ) {
        return this.define( "init", fn );
    })

    .directive( "create", function() {
        this.ctor.trigger( "create" );
        return this.ctor;
    })

    .create();

var Dog = Core.extend( "Dog" )

    .private()
    .define( "hello", 12 )

    .define( "world", function() {
        console.log( this )
        return this.hello
    })

    .define( "foo", function() {
        this.hello += 1;
        return this;
    })

    .create();

console.log( new Dog().foo().world() )



var Promise = Core.extend( "Promise" )

    .init(function(fn) {
        var that = this;
        var onfulfill = this.__onfulfill = [];
        var onreject  = this.__onreject = [];
        var next = ( process && process.nextTick )
            ? process.nextTick
            : function( fn ) { setTimeout( fn, 1 ); }
            ;

        var fulfill = function( value ) {
            next(function() {
                if ( !onfulfill.length ) return;
                onfulfill.shift()( value );
                fulfill( value );
            })
        };

        var reject = function( reason ) {
            next(function() {
                if ( !onreject.length ) return;
                onreject.shift()( reason );
                reject( value );
            })
        };

        fn( fulfill, reject );
    })

    .define( "resolve", function( x, fulfill, reject ) {
        var that = this;
        if ( this == x ) {
            return reject( new TypeError() );
        }

        // if ( x instanceof Promise ) {
        //     x.on( "fulfilled", function( ev, v ) { fulfill( v ) } );
        //     x.on( "rejected",  function( ev, r ) { reject( r )  } );
        //     return;
        // }

        if ( [ "object", "function" ].indexOf( typeof x ) == -1 ) {
            return fulfill( x )
        }

        try {
            var then = x.then
        } catch( e ) {
            return reject( e );
        }

        if ( typeof then != "function" ) {
            return fulfill( x );
        }

        var called = false;
        try {
            then.call( x, function( y ) { // resolve promise
                if ( called ) return;
                called = true;
                that.resolve( y, fulfill, reject );
            }, function( r ) { // reject promise
                if ( called ) return;
                called = true;
                reject( r );
            })
        } catch( e ) {
            if ( called ) return;
            reject( e );
        }
    })

    .define( "then", function( onfulfill, onreject ) {
        var that = this;
        var resolve = that.resolve;
        var promise = new Promise(function( fulfill, reject ) {
            that.__onfulfill.push(function( value ) {
                if ( typeof onfulfill != "function" ) {
                    fulfill( value );
                    return;
                }

                try {
                    resolve.call( this, onfulfill( value ), fulfill, reject );
                } catch( e ) {
                    reject( e );
                }
            });

            that.__onreject.push(function( reason ) {
                if ( typeof onreject != "function" ) {
                    reject( reason );
                    return;
                }

                try {
                    resolve.call( this, onreject( reason ), fulfill, reject );
                } catch( e ) {
                    reject( e );
                }
            });

        });

        return promise;
    })

    .define( "catch", function( onreject ) {
        return this.then( null, onreject );
    })

    .create();
