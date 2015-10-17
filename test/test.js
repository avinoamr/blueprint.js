var assert = require( "assert" );
var blueprint = require( ".." );

describe( "blueprint", function() {

    it( "creates an empty class with the correct name", function() {
        var A = blueprint( "A" ).compile();
        assert.equal( A.name, "A" );
    });


    it( "evaluates instanceof correctly", function() {
        var Animal = blueprint( "Animal" ).compile();
        var Dog = Animal.extend( "Dog" ).compile();
        var Cat = Animal.extend( "Cat" ).compile();

        // animal is an animal
        assert( new Animal() instanceof Animal );
        assert( !( new Animal() instanceof Dog ) );

        // dog is an animal and a dog
        assert( new Dog() instanceof Animal );
        assert( new Dog() instanceof Dog );
        assert( !( new Dog() instanceof Cat ) );

        // cat is an animal and a cat
        assert( new Cat() instanceof Animal );
        assert( new Cat() instanceof Cat );
        assert( !( new Cat() instanceof Dog ) );
    });


    it( "keeps a reference to the constructor", function() {
        var Dog = blueprint( "Dog" ).compile();
        assert.equal( new Dog().constructor.name, "Dog" );
    });


    it( "inherits and overrides methods", function() {
        var Animal = blueprint( "Animal" )
            .define( "say", function() {
                throw new Error( "Abstract method not implemented");
            })
            .compile();

        var Dog = Animal.extend( "Dog" )
            .define( "say", function() {
                return "Whoof";
            })
            .compile();

        assert.throws( function() { new Animal().say() } );
        assert.equal( new Dog().say(), "Whoof" );
    });


    it( "Supports multiple inheritance with mixins", function() {
        var Dog = blueprint( "Dog" )
            .define( "say", function() {
                return "Whoof";
            })
            .compile();

        var Echoable = blueprint( "Echoable" )
            .define( "echo", function( something ) {
                return something;
            })
            .compile();

        var EchoableDog = Dog.extend( "EchoableDog" )
            .mixin( Echoable )
            .define( "sleep", function() {
                return "Zzz...";
            })
            .compile();
    });


    it( "supports the events API", function( done ) {
        var Dog = blueprint( "Dog" )
            .define( "sleep", function() {
                this.trigger( "sleep", "arg1", "arg2" );
                return "Zzz...";
            })
            .compile();

        assert.equal( new Dog().sleep(), "Zzz..." ); // no errors
        var d1 = new Dog();
        var d2 = new Dog();

        var l;
        d2.on( "sleep", l = function() {
            assert( false, "will be removed shortly" );
        }).off( "sleep", l );

        d1.on( "sleep", function( name, arg1, arg2 ) {
            assert.equal( arg1, "arg1" );
            assert.equal( arg2, "arg2" );
            done()
        });
        d1.sleep()
        d2.sleep();
    });


    it( "supports inline decorations", function() {
        var DisorientedDog = blueprint( "Dog" )
            .decorate(function() {
                return function( name, value ) {
                    return function() { return "Meow..." }
                }
            })
            .define( "bark", function() {
                return "Whoof"
            })
            .compile();

        assert.equal( new DisorientedDog().bark(), "Meow..." )
    })


    it( "supports named decoration", function() {
        var DisorientedDog = blueprint( "Dog" )
            .decorate( "meow", function() {
                return function( name, value ) {
                    return function() { return "Meow..." }
                }
            })
            .meow()
            .define( "bark", function() {
                return "Whoof"
            })
            .compile();

        assert.equal( new DisorientedDog().bark(), "Meow..." )
    })


    it( "uses the .init constructor", function() {
        var Dog = blueprint()
            .init(function() {
                this.args = arguments
            })
            .compile();

        var d1 = new Dog( 1, 2 );
        var d2 = new Dog( "hello" )
        assert.equal( d1.args[ 0 ], 1 )
        assert.equal( d1.args[ 1 ], 2 )
        assert.equal( d2.args[ 0 ], "hello" )
    })

    it( "can extend non-blueprint classes", function() {
        var Class = function() {
            this.one = "two";
        };
        Class.prototype.hello = function() {
            return "world";
        };
        Class.foo = function() {
            return "bar";
        }
        var Dog = blueprint( Class )
            .compile();

        assert.equal( Dog.foo(), "bar" );
        assert.equal( new Dog().hello(), "world" );
        assert.equal( new Dog().constructor, Dog );
        assert.equal( new Dog().one, "two" );
        assert( new Dog() instanceof Class );
    })

});

describe( "built-in decorators", function() {

    it( "static()", function() {
        var A = blueprint()
            .static()
            .define( "echo", function( v ) { return v })
            .compile();

        assert.equal( typeof new A().echo, "undefined" );
        assert.equal( A.echo( 15 ), 15 );
    });

    it( "bind()", function() {
        var i = 0;
        var A = blueprint()
            .bind({ hello: "world" })
            .define( "work", function() { return this.hello })

            .bind(function() { return { foo: ++i } })
            .define( "i", function() { return this.foo })
            .compile();

        assert.equal( new A().work(), "world" );
        assert.equal( new A().i(), 1 );
        assert.equal( new A().i(), 2 );
    });

    it( "alias()", function() {
        var A = blueprint()
            .alias( "hello" )
            .define( "world", function() { return 12 })
            .compile();

        assert.equal( new A().hello(), 12 );
        assert.equal( new A().world(), 12 );
    });

    it( "trigger()", function( done ) {
        var A = blueprint()
            .trigger( "hello_ev" )
            .define( "hello", function() {
                return "world";
            })
            .compile();

        new A().on( "hello_ev", function( name, options ) {
            assert.equal( name, "hello_ev" );
            assert.equal( options.arguments[ 0 ], 1 );
            assert.equal( options.arguments[ 1 ], 2 );
            done();
        }).hello( 1, 2 );
    });
})

describe( "thenable, then and catch", function() {

    it( "supports the 'thenable' decorator", function( done ) {
        var A = blueprint()
            .thenable()
            .define( "work", function( value, fulfill, reject ) {
                fulfill( value * 2 )
            })
            .compile();

        new A().work( 15 ).then(function( v ) {
            assert.equal( v, 30 );
            done();
        });
    });


    it( "fulfills for sync methods", function() {
        var A = blueprint()
            .define( "work", function( value ) {
                return value * 2;
            })
            .then(function( value ) {
                return value * 2;
            })
            .compile();

        assert.equal( new A().work( 123 ), 123 * 4 );
    });


    it( "catches for sync methods", function( done ) {
        var A = blueprint()
            .define( "work", function() {
                throw new Error( "Bad" );
            })
            .catch( function( err ) {
                assert.equal( err.message, "Bad" );
                done();
            })
            .compile();
        new A().work();
    })


    it( "fulfills for async methods", function( done ) {
        var A = blueprint()
            .thenable()
            .define( "work", function( value, fulfill, reject ) {
                fulfill( value * 2 )
            })
            .then(function( v ) {
                return v * 2;
            })
            .compile();

        new A().work( 123 ).then(function( v ) {
            assert.equal( v, 123 * 4 );
            done()
        });
    });


    it( "rejects for async methods", function( done ) {
        var A = blueprint()
            .thenable()
            .define( "work", function( fulfill, reject ) {
                reject( new Error( "Bad" ) );
            })
            .catch( function( err ) {
                assert.equal( err.message, "Bad" );
                done();
            })
            .compile();
        new A().work();
    });


    it( "chains multiple thenables", function( done ) {
        var A = blueprint()
            .thenable()
            .define( "work", function( value, fulfill, reject ) {
                fulfill( value * 2 )
            })

            .thenable()
            .then(function( value, fulfill, reject ) {
                fulfill( value * 2 );
            })

            .thenable()
            .then(function( value, fulfill, reject ) {
                fulfill( value / 4 )
            })

            .compile();

        new A().work( 123 ).then(function( v ) {
            assert.equal( v, 123 );
            done();
        })
    })


});

describe( "Promise", function() {

    it( "thenable", function( done ) {
        var p = new blueprint.Promise(function( fulfill, reject ) {
            fulfill( 12 )
        }).then(function( value ) {
            assert.equal( value, 12 );
            done();
        }).catch(function( reason ) {
            done( new Error( "Unexpected reject" ) )
        });
        assert( p.then ); // returns promisable
    });


    it ( "catches rejects", function( done ) {
        new blueprint.Promise(function( fulfill, reject ) {
            reject( 12 )
        }).then(function() {
            done( new Error( "Unexpected fulfill" ) );
        }).catch(function( reason ) {
            assert.equal( reason, 12 );
            done()
        })
    });

});


describe( "Model", function() {

    var Model = blueprint.Model;

    // reset the backend for every test
    beforeEach( function() {
        Model.backend( null );
    });

    it( "forwards all calls to the underlying backend", function( done ) {
        var Dog = Model.extend( "Dog" ).compile();

        var actions = [];
        Model.backend({
            save: function( model ) {
                assert.equal( model, d );
                actions.push( "s" );
            },
            load: function( model ) {
                assert.equal( model, d );
                actions.push( "l" );
            },
            remove: function( model ) {
                assert.equal( model, d );
                actions.push( "r" );
            },
            find: function( Model, cursor ) {
                assert.equal( Model, Dog );
                assert.deepEqual( cursor.query(), { hello: "world" } );
                assert.deepEqual( [ "s", "l", "r" ], actions );
                done();
            }
        });

        var d = new Dog();
        d.save()
        d.load()
        d.remove()
        Dog.find( { hello: "world" } );

    });


    it( "supports backend inheritance and override", function( done ) {

        var Dog = Model.extend( "Dog" ).compile();
        var Cat = Model.extend( "Cat" ).compile();

        // set the root datastore
        Model.backend({
            save: function( model ) {
                assert.equal( model.constructor, Cat );
            }
        })

        // set a different datastore specifically for dogs
        Dog.backend({
            save: function( model ) {
                assert.equal( model.constructor, Dog );
                done();
            }
        });

        // save them
        new Cat().save();
        new Dog().save();

    });


    it( "supports removal of backends", function( done ) {

        var Dog = Model.extend( "Dog" ).compile();

        var d = new Dog();
        Model.backend({
            save: function( model ) {
                assert.equal( model, d );
                done();
            }
        });

        Dog.backend({
            save: function( model ) {
                assert( false, "this backend has been detached" );
            }
        });

        Dog.backend( null );
        d.save();

    });


    it( "throws an error when no backend is assigned", function() {
        assert.throws( function() { new Model().save() } );
    })

});


// // default in-memory datastore
describe( "Backend", function() {

    var Model = blueprint.Model;
    var MemoryBackend = blueprint.MemoryBackend;

    it( "saves and loads objects", function() {
        var be = new MemoryBackend();
        var m = new Model({ id: 5, hello: "world" })
        be.save( m, {} );

        m = new Model({ id: 5 });
        be.load( m, {} );
        assert.equal( m.hello, "world" );
    });


    it( "removes objects", function( done ) {
        var be = new MemoryBackend();
        var m = new Model({ id: 5, hello: "world" });
        be.save( m, {} );

        be.remove( m, {} );
        m = new Model({ id: 5 });
        be.load( m, {} ).catch(function( e ) {
            assert( String( e ).match( /not found/ ) );
            done();
        })
    });


    it( "generates object IDs", function() {
        var be = new MemoryBackend();
        var m1 = new Model({ hello: "world" });
        var m2 = new Model({ foo: "bar" });

        be.save( m1, {} )
        be.save( m2, {} );
        assert( m1.id );
        assert( m2.id );
        assert.notEqual( m1.id, m2.id );
    });


    // it( "emits on all operations", function( done ) {
    //     var be = new MemoryBackend();

    //     var actions = [];
    //     var m = new Model()
    //         .on( "saved", function() {
    //             actions.push( "s" );
    //         })
    //         .on( "loaded", function() {
    //             actions.push( "l" );
    //         })
    //         .on( "removed", function() {
    //             actions.push( "r" );
    //             done();
    //         });

    //     ds.save( m ).load( m ).remove( m );
    // })
});