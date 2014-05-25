/*
 * Blueprint
 */
var extend = function( obj, var_args ) {
    for ( var i = 1; i < arguments.length ; i += 1 ) {
        var other = arguments[ i ];
        for ( var p in other ) {
            var v = Object.getOwnPropertyDescriptor( other, p );
            if ( typeof v == "undefined" || typeof v.value == "undefined" ) {
                delete obj[ p ];
            } else {
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
    .configure(function Core() {
        this.ctor = function() {
            if ( this.init ) {
                this.init.apply( this.arguments );
            }
        };

        this.__decorators = [];
        this.apply_decorators = function( name, value ) {
            while ( this.__decorators.length ) {
                value = this.__decorators.shift().call( this, name, value )
            }
            return value;
        }

        this.directive = function( name, fn ) {
            fn = this.apply_decorators( name, fn );
            this[ name ] = fn;
            return this;
        }
    })

    // .decorate( name, decorator )
    //  basic function decoration logic
    .directive( "decorate", function( name, decorator ) {
        var that = this;
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


    // define
    // adds a new key-value pair to the class
    .directive( "define", function( name, value ) {
        value = this.apply_decorators( name, value )
        var obj = this.ctor.prototype;
        if ( this.__static ) {
            delete this.__static;
            obj = this.ctor;
        }

        obj[ name ] = value;
        this.ctor.trigger( "define", { name: name, value: value, obj: obj } );
        return this;
    })


    // static
    // decorates the next definition to be attached to the class as a static
    // member instead of an instance member
    .decorate( "static", function() {
        this.__static = true;
        return function( name, value ) {
            return value;
        }
    })

    // .trigger( name, [ arg1, args2, ... ] )
    // triggers an event by name to all of the attached listeners (if any)
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

    // .on( name, listener )
    // adds a new event listener to events of the given name
    .static()
    .define( "on", function( name, fn ) {
        this.__events || ( this.__events = {} );
        this.__events[ name ] || ( this.__events[ name ] = [] );

        // avoid duplicates
        if ( this.__events[ name ].indexOf( fn ) != -1 ) return this;
        this.__events[ name ].push( fn )
        return this;
    })

    // .off( name, listener )
    // removes an existing listener from the events of the given name
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

    // add the event methods to the prototype as well
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

    // .bind( to, [ restore ] )
    // decorates the next defined method to run with the provided context
    .decorate( "bind", function( to, restore ) {
        return function( name, fn ) {
            if ( typeof fn != "function" ) {
                throw new Error( "'bind' decorator is only applicable to functions" )
            }

            var that = this;
            return function() {
                var _to = ( typeof to == "function" ) ? to.call( that, this ) : to;
                return fn.apply( _to, arguments );
            }
        }
    })

    // .extend( name )
    //  create a new sub-class which will inherit from the current class
    .bind(function() { return this } )
    .static()
    .define( "extend", function( name ) {
        var _super = this.ctor;
        var ctor = "(function NAME(){return _super.apply(this,arguments)})";
        ctor = ctor.replace( "NAME", name || "" );
        ctor = extend( eval( ctor ), this.ctor );
        ctor.prototype = Object.create( this.ctor.prototype );
        ctor.prototype.constructor = ctor;
        var subcls = extend( Object.create( this ), { 
            ctor: ctor, super: this, privates: {}, static_privates: {}
        })
        this.ctor.trigger( "extend", ctor );
        return subcls;
    })

    // .private()
    //  decorates the next definition as a private property
    .decorate( "private", (function() {
        var return_ = function( name, value ) {
            if ( !this.hasOwnProperty( "__privalize_defined" ) ) {
                var cls = this;
                this.__privalize_defined = true;
                this.ctor.on( "create", function() { privatize( cls ) } );
            }

            if ( this.__static ) {
                this.static_privates[ name ] = value;
            } else {
                this.privates[ name ] = value;
            }
            return value;
        };

        var privatize = function( cls ) {
            wrap_obj( cls.ctor.prototype, cls.privates );
            wrap_obj( cls.ctor, cls.static_privates );
        };

        var wrap_obj = function( obj, privates ) {
            var key, value;
            for ( key in privates ) {
                delete obj[ key ];
            }

            for ( key in obj ) {
                if ( key == "constructor" ) continue;
                if ( !obj.hasOwnProperty( key ) ) continue;
                value = obj[ key ];
                if ( typeof value != "function" ) continue;
                if ( value.original ) value = value.original;
                value = wrap( value, privates );
                obj[ key ] = value;
            }
        };

        var wrap = function( fn, privates ) {
            return extend(function() {
                // save a copy of the previous object properties
                var old = {}, key;
                for ( key in privates ) {
                    old[ key ] = this[ key ];
                }

                // extend the object with the private properties
                extend( this, privates );

                // run the original function
                var rv = fn.apply( this, arguments );

                // find changes to the attached properties
                var modified = {};
                for ( key in privates ) {
                    if ( privates[ key ] != this[ key ] ) {
                        modified[ key ] = this[ key ];
                    }
                }

                // restore the object to its original state
                extend( this, old );

                // private properties were modified for this instance
                if ( Object.keys( modified ).length ) {
                    modified = extend( {}, privates, modified );
                    if ( typeof this != "function" ) {
                        extend( this, Object.getPrototypeOf( this ), { 
                            constructor: undefined // remove the constructor
                        })
                    }
                    wrap_obj( this, modified );
                }

                return rv;
            }, { original: fn } );
        }

        return function() { return return_ };
    })())

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

        return function( name, fn ) {
            if ( typeof fn != "function" ) {
                var err = "'property' decorator requires a function"
                throw new TypeError( err )
            }
            return value;
        }
    })

    // .alias( name )
    //  decorate the next definition to also be assigned to the provided name
    .decorate( "alias", function( other ) {
        return function( name, value ) {
            this.ctor.on( "define", function( ev, options ) {
                this.off( "define", arguments.callee );
                var v = Object.getOwnPropertyDescriptor( options.obj, options.name );
                Object.defineProperty( options.obj, other, v );
            })
            return value;
        }
    })

    /** PROMISES **/
    .decorate( "promise", function() {
        return function( name, fn ) {
            return function() {
                var args = [].slice.call( arguments );
                var that = this;
                return new Promise(function( fulfill, reject ) {
                    args.push( fulfill, reject )
                    fn.apply( that, args );
                })
            }
        }
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
    .define( "hello", 15 )

    .define( "world", function() {
        this.hello += 1
        return this.hello
    })

    .create();

var d1 = new Dog();
var d2 = new Dog();
console.log( d1.world(), d1.world(), d2.world(), d1 )



// var Promise = Core.extend( "Promise" )

//     .init(function(fn) {
//         var that = this;
//         var onfulfill = this.__onfulfill = [];
//         var onreject  = this.__onreject = [];
//         var next = ( process && process.nextTick )
//             ? process.nextTick
//             : function( fn ) { setTimeout( fn, 1 ); }
//             ;

//         var fulfill = function( value ) {
//             next(function() {
//                 if ( !onfulfill.length ) return;
//                 onfulfill.shift()( value );
//                 fulfill( value );
//             })
//         };

//         var reject = function( reason ) {
//             next(function() {
//                 if ( !onreject.length ) return;
//                 onreject.shift()( reason );
//                 reject( value );
//             })
//         };

//         fn( fulfill, reject );
//     })

//     .define( "resolve", function( x, fulfill, reject ) {
//         var that = this;
//         if ( this == x ) {
//             return reject( new TypeError() );
//         }

//         // if ( x instanceof Promise ) {
//         //     x.on( "fulfilled", function( ev, v ) { fulfill( v ) } );
//         //     x.on( "rejected",  function( ev, r ) { reject( r )  } );
//         //     return;
//         // }

//         if ( [ "object", "function" ].indexOf( typeof x ) == -1 ) {
//             return fulfill( x )
//         }

//         try {
//             var then = x.then
//         } catch( e ) {
//             return reject( e );
//         }

//         if ( typeof then != "function" ) {
//             return fulfill( x );
//         }

//         var called = false;
//         try {
//             then.call( x, function( y ) { // resolve promise
//                 if ( called ) return;
//                 called = true;
//                 that.resolve( y, fulfill, reject );
//             }, function( r ) { // reject promise
//                 if ( called ) return;
//                 called = true;
//                 reject( r );
//             })
//         } catch( e ) {
//             if ( called ) return;
//             reject( e );
//         }
//     })

//     .define( "then", function( onfulfill, onreject ) {
//         var that = this;
//         var resolve = that.resolve;
//         var promise = new Promise(function( fulfill, reject ) {
//             that.__onfulfill.push(function( value ) {
//                 if ( typeof onfulfill != "function" ) {
//                     fulfill( value );
//                     return;
//                 }

//                 try {
//                     resolve.call( this, onfulfill( value ), fulfill, reject );
//                 } catch( e ) {
//                     reject( e );
//                 }
//             });

//             that.__onreject.push(function( reason ) {
//                 if ( typeof onreject != "function" ) {
//                     reject( reason );
//                     return;
//                 }

//                 try {
//                     resolve.call( this, onreject( reason ), fulfill, reject );
//                 } catch( e ) {
//                     reject( e );
//                 }
//             });

//         });

//         return promise;
//     })

//     .define( "catch", function( onreject ) {
//         return this.then( null, onreject );
//     })

//     .create();
