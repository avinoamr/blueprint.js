var assert = require( "assert" );
var blueprint = require( ".." );

describe( "blueprint", function() {

    it( "creates an empty class with the correct name", function() {
        var A = blueprint( "A" ).create();
        assert.equal( A.name, "A" );
    });


    it( "evaluates instanceof correctly", function() {
        var Animal = blueprint( "Animal" ).create();
        var Dog = Animal.extend( "Dog" ).create();
        var Cat = Animal.extend( "Cat" ).create();

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
        var Dog = blueprint( "Dog" ).create();
        assert.equal( new Dog().constructor.name, "Dog" );
    });


    it( "inherits and overrides methods", function() {
        var Animal = blueprint( "Animal" )
            .define( "say", function() {
                throw new Error( "Abstract method not implemented");
            })
            .create();

        var Dog = Animal.extend( "Dog" )
            .define( "say", function() {
                return "Whoof";
            })
            .create();

        assert.throws( function() { new Animal().say() } );
        assert.equal( new Dog().say(), "Whoof" );
    });


    it( "Supports multiple inheritance with mixins", function() {
        var Dog = blueprint( "Dog" )
            .define( "say", function() {
                return "Whoof";
            })
            .create();

        var Echoable = blueprint( "Echoable" )
            .define( "echo", function( something ) {
                return something;
            })
            .create();

        var EchoableDog = Dog.extend( "EchoableDog" )
            .mixin( Echoable )
            .define( "sleep", function() {
                return "Zzz...";
            })
            .create();
    });


    it( "supports the events API", function( done ) {
        var Dog = blueprint( "Dog" )
            .define( "sleep", function() {
                this.trigger( "sleep", "arg1", "arg2" );
                return "Zzz...";
            })
            .create();

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
            .create();

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
            .create();

        assert.equal( new DisorientedDog().bark(), "Meow..." )
    })


    it( "uses the .init constructor", function() {
        var Dog = blueprint()
            .init(function() {
                this.args = arguments
            })
            .create();

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
            .create();

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
            .create();

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
            .create();

        assert.equal( new A().work(), "world" );
        assert.equal( new A().i(), 1 );
        assert.equal( new A().i(), 2 );
    });

    it( "alias()", function() {
        var A = blueprint()
            .alias( "hello" )
            .define( "world", function() { return 12 })
            .create();

        assert.equal( new A().hello(), 12 );
        assert.equal( new A().world(), 12 );
    });

    it( "trigger()", function( done ) {
        var A = blueprint()
            .trigger( "hello_ev" )
            .define( "hello", function() {
                return "world";
            })
            .create();

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
            .create();

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
            .create();

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
            .create();
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
            .create();

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
            .create();
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

            .create();

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


// describe( "Model", function() {

//     // reset the datastore for every test
//     beforeEach( function() {
//         Model.datastore( null );
//     });

//     it( "forwards all calls to the underlying datastore", function( done ) {
//         var Dog = Model.extend( "Dog" );
//         var d = new Dog();

//         var actions = [];
//         Model.datastore({
//             save: function( model ) {
//                 assert.equal( model, d );
//                 actions.push( "s" );
//             },
//             load: function( model ) {
//                 assert.equal( model, d );
//                 actions.push( "l" );
//             },
//             remove: function( model ) {
//                 assert.equal( model, d );
//                 actions.push( "r" );
//             },
//             find: function( cursor ) {
//                 assert.equal( cursor.Model, Dog );
//                 assert.deepEqual( cursor.criteria, { hello: "world" } );
//                 assert.deepEqual( [ "s", "l", "r" ], actions );
//                 done();
//             }
//         });

//         d.save().load().remove();
//         Dog.find( { hello: "world" } );

//     } );


//     it( "supports datastore inheritance and override", function( done ) {

//         var Dog = Model.extend( "Dog" );
//         var Cat = Model.extend( "Cat" );

//         // set the root datastore
//         Model.datastore({
//             save: function( model ) {
//                 assert.equal( model.constructor, Cat );
//             }
//         })

//         // set a different datastore specifically for dogs
//         Dog.datastore({
//             save: function( model ) {
//                 assert.equal( model.constructor, Dog );
//                 done();
//             }
//         });

//         // save them
//         new Cat().save();
//         new Dog().save();

//     } );


//     it( "supports removal of datastores", function( done ) {

//         var Dog = Model.extend( "Dog" );

//         var d = new Dog();
//         Model.datastore({
//             save: function( model ) {
//                 assert.equal( model, d );
//                 done();
//             }
//         });

//         Dog.datastore({
//             save: function( model ) {
//                 assert( false, "this datastore has been detached" );
//             }
//         });

//         Dog.datastore( null );
//         d.save();

//     });


//     it( "throws an error when no datastore is assigned", function() {
//         assert.throws( function() { new Model().save() } );
//     })

// });


// // default in-memory datastore
// describe( "Datastore", function() {

//     it( "saves and loads objects", function() {
//         var ds = new Datastore();
//         var m = new Model().extend({
//             id: 5,
//             hello: "world"
//         });
//         ds.save( m );

//         m = new Model().extend({ id: 5 });
//         ds.load( m );
//         assert.equal( m.hello, "world" );
//     });


//     it( "removes objects", function( done ) {
//         var ds = new Datastore();
//         var m = new Model().extend({
//             id: 5,
//             hello: "world"
//         });
//         ds.save( m );

//         ds.remove( m );
//         m = new Model().extend({ id: 5 });
//         m.on( "error", function() {
//             done();
//         })
//         ds.load( m );
//     });


//     it( "generates object IDs", function() {
//         var ds = new Datastore();
//         var m1 = new Model().extend({
//             hello: "world"
//         });
//         var m2 = new Model().extend({
//             foo: "bar"
//         });

//         ds.save( m1 ).save( m2 );
//         assert( m1.id );
//         assert( m2.id );
//         assert.notEqual( m1.id, m2.id );
//     });


//     it( "emits on all operations", function( done ) {
//         var ds = new Datastore();

//         var actions = [];
//         var m = new Model()
//             .on( "saved", function() {
//                 actions.push( "s" );
//             })
//             .on( "loaded", function() {
//                 actions.push( "l" );
//             })
//             .on( "removed", function() {
//                 actions.push( "r" );
//                 done();
//             });

//         ds.save( m ).load( m ).remove( m );
//     })
// });


// describe( "Field", function() {


//     it( "it uses defaults", function() {

//         var Dog = Model.extend( "Dog", {
//             title: new blueprint.Field({})
//         });

//         assert.equal( new Dog().title, null );

//         var Cat = Model.extend( "Cat", {
//             title: new blueprint.Field({ default: "hello" })
//         });

//         assert.equal( new Cat().title, "hello" );

//     });


//     it( "required validation (by default)", function() {

//         var Dog = Model.extend( "Dog", {
//             title: new blueprint.Field()
//         }).datastore( new Datastore() );

//         assert.throws( function() { new Dog().save(); }, function( err ) {
//             assert( err.message.match( /Validation\ Error/i ) );
//             assert( err.message.match( /required/i ) );
//             assert.equal( err.property, "title" );
//             return err instanceof Error
//         } );

//         new Dog().extend({ title: "Rocky" }).save(); // no error

//         var Cat = Model.extend( "Cat", {
//             title: new blueprint.Field({ required: false })
//         }).datastore( new Datastore() );

//         new Cat().save(); // no error as it's not required

//     });

// });


// describe( "String", function() {


//     it( "verifies variable type", function() {

//         var Dog = Model.extend( "Dog", {
//             title: new blueprint.String()
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ title: 100 }); // invalid
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /not a string/i ) );
//             return true;
//         } );

//         d.extend({ title: "cookie" });
//         d.save(); // no errors

//     });


//     it( "minimum and maximum values", function() {
//         var Dog = Model.extend( "Dog", {
//             title: new blueprint.String({ min: 3, max: 5 })
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ title: "ab" });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /minimum/i ) );
//             return true;
//         } );

//         d.extend({ title: "abcdef" });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /maximum/i ) );
//             return true;
//         } );

//         d.extend({ title: "abcde" }).save(); // exactly 5 - no error
//         d.extend({ title: "abc" }).save(); // exactly 3 - no error
//     })


//     it( "matches regexp", function() {
//         var Dog = Model.extend( "Dog", {
//             title: new blueprint.String({ regexp: /^[a-zA-Z].*/ })
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ title: "5ab" });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /regexp/i ) );
//             return true;
//         } );

//         d.extend({ title: "ab5" }).save(); // no error
//     } );

// });


// describe( "Number", function() {

//     it( "verified variable type is a number", function() {
//         var Dog = Model.extend( "Dog", {
//             age: new blueprint.Number()
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ age: "hello" });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /not a number/i ) );
//             return true;
//         } );

//         d.extend({ age: 5 }).save(); // no error
//     } );


//     it( "minimum and maximum values", function() {
//         var Dog = Model.extend( "Dog", {
//             age: new blueprint.Number({ min: 0, max: 20 })
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ age: -1 });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /minimum/i ) );
//             return true;
//         } );

//         d.extend({ age: 21 });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /maximum/i ) );
//             return true;
//         } );

//         d.extend({ age: 0 }).save();
//          d.extend({ age: 20 }).save();

//     });

// });


// describe( "List", function() {

//     it( "verified variable type is an array", function() {
//         var Dog = Model.extend( "Dog", {
//             owners: new blueprint.List()
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ owners: 123 });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /not a list/i ) );
//             return true;
//         } );

//         d.extend({ owners: [] }).save();
//     });


//     it( "minimum and maximum values", function() {
//         var Dog = Model.extend( "Dog", {
//             owners: new blueprint.List({ min: 1, max: 3 })
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ owners: [] });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /minimum/i ) );
//             return true;
//         } );

//         d.extend({ owners: [ 1, 2, 3, 4 ] });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /maximum/i ) );
//             return true;
//         } );

//         d.extend({ owners: [ 1 ] }).save();
//         d.extend({ owners: [ 1, 2, 3 ] }).save();
//     });


//     it( "validates recursively the items in the list", function() {
//         var Dog = Model.extend( "Dog", {
//             nicknames: new blueprint.List({ of: new blueprint.String() })
//         }).datastore( new Datastore() );


//         var d = new Dog().extend({ nicknames: [ "rocky", 5 ] });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /not a string/i ) );
//             return true;
//         } );

//         d.extend({ nicknames: [ "rocky", "browney" ] }).save();
//     });
// });


// describe( "Boolean", function() {

//     it( "verified variable type is a bool", function() {
//         var Dog = Model.extend( "Dog", {
//             happy: new blueprint.Boolean()
//         }).datastore( new Datastore() );

//         var d = new Dog().extend({ happy: "okay" });
//         assert.throws( function() { d.save(); }, function( err ) {
//             assert( err.message.match( /not a boolean/i ) );
//             return true;
//         } );

//         d.extend({ happy: true }).save();
//     });

// });