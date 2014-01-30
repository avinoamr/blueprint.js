var assert = require( "assert" );
var blueprint = require( ".." );

var Blueprint = blueprint.Blueprint;
var Datastore = blueprint.Datastore;
var Model = blueprint.Model;

describe( "Blueprint", function() {

    it( "creates an empty class with the correct name", function() {
        var A = Blueprint.extend( "A" );
        assert.equal( A.name, "A" );
    });


    it( "evaluates instanceof correctly", function() {
        var Animal = Blueprint.extend( "Animal" );
        var Dog = Animal.extend( "Dog" );
        var Cat = Animal.extend( "Cat" );

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
        var Dog = Blueprint.extend( "Dog" );
        assert.equal( new Dog().constructor.name, "Dog" );
        assert.deepEqual( new Dog().constructor.parents, [ Blueprint ] );
    });


    it( "inherits and overrides methods", function() {
        var Animal = Blueprint.extend( "Animal", {
            say: function() {
                throw new Error( "Abstract method not implemented");
            }
        });

        var Dog = Animal.extend( "Dog", {
            say: function() {
                return "Whoof";
            }
        });

        assert.throws( function() { new Animal().say() } );
        assert.equal( new Dog().say(), "Whoof" );
    });


    it( "Supports multiple inheritance", function() {
        var Dog = Blueprint.extend( "Dog", {
            say: function() {
                return "Whoof";
            }
        });

        var Echoable = Blueprint.extend( "Echoable", {
            echo: function( something ) {
                return something;
            }
        });

        var EchoableDog = Dog.extend( "EchoableDog", Echoable, {
            sleep: function() {
                return "Zzz...";
            }
        });

        assert.equal( new EchoableDog().say(), "Whoof" );
        assert.equal( new EchoableDog().sleep(), "Zzz..." );
        assert.equal( new EchoableDog().echo( "Jump!" ), "Jump!" );
    });


    it( "supports the events API", function( done ) {
        var Dog = Blueprint.extend( "Dog", {
            sleep: function() {
                this.emit( "sleep", "arg1", "arg2" );
                return "Zzz...";
            }
        });

        assert.equal( new Dog().sleep(), "Zzz..." ); // no errors
        var d1 = new Dog();
        var d2 = new Dog();

        var l;
        d2.on( "sleep", l = function() {
            assert( false, "will be removed shortly" );
        }).off( "sleep", l );

        d1.on( "sleep", function( arg1, arg2 ) {
            assert.equal( arg1, "arg1" );
            assert.equal( arg2, "arg2" );
            done()
        });
        d1.sleep()
        d2.sleep();
    });


    it( "converts to a normal object without private variables", function() {
        var b = new Blueprint({
            hello: "world"
        });
        b.on( "something", function() {});

        assert.deepEqual( b.toObject(), { hello: "world" });
    } );

});


describe( "Model", function() {

    // reset the datastore for every test
    beforeEach( function() {
        Model.datastore( null );
    });

    it( "forwards all calls to the underlying datastore", function( done ) {
        var Dog = Model.extend( "Dog" );
        var d = new Dog();

        var actions = [];
        Model.datastore({
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
            find: function( M, criteria ) {
                assert.equal( M, Dog );
                assert.deepEqual( criteria, { hello: "world" } );
                assert.deepEqual( [ "s", "l", "r" ], actions );
                done();
            }
        });

        d.save().load().remove();
        Dog.find( { hello: "world" } );

    } );


    it( "supports datastore inheritance and override", function( done ) {

        var Dog = Model.extend( "Dog" );
        var Cat = Model.extend( "Cat" );

        // set the root datastore
        Model.datastore({
            save: function( model ) {
                assert.equal( model.constructor, Cat );
            }
        })

        // set a different datastore specifically for dogs
        Dog.datastore({
            save: function( model ) {
                assert.equal( model.constructor, Dog );
                done();
            }
        });

        // save them
        new Cat().save();
        new Dog().save();

    } );


    it( "supports removal of datastores", function( done ) {

        var Dog = Model.extend( "Dog" );

        var d = new Dog();
        Model.datastore({
            save: function( model ) {
                assert.equal( model, d );
                done();
            }
        });

        Dog.datastore({
            save: function( model ) {
                assert( false, "this datastore has been detached" );
            }
        });

        Dog.datastore( null );
        d.save();

    });


    it( "throws an error when no datastore is assigned", function() {
        assert.throws( function() { new Model().save() } );
    })

});


// default in-memory datastore
describe( "Datastore", function() {

    it( "saves and loads objects", function() {
        var ds = new Datastore();
        var m = new Model().extend({
            id: 5,
            hello: "world"
        });
        ds.save( m );

        m = new Model().extend({ id: 5 });
        ds.load( m );
        assert.equal( m.hello, "world" );
    });


    it( "removes objects", function( done ) {
        var ds = new Datastore();
        var m = new Model().extend({
            id: 5,
            hello: "world"
        });
        ds.save( m );

        ds.remove( m );
        m = new Model().extend({ id: 5 });
        m.on( "error", function() {
            done();
        })
        ds.load( m );
    });


    it( "generates object IDs", function() {
        var ds = new Datastore();
        var m1 = new Model().extend({
            hello: "world"
        });
        var m2 = new Model().extend({
            foo: "bar"
        });

        ds.save( m1 ).save( m2 );
        assert( m1.id );
        assert( m2.id );
        assert.notEqual( m1.id, m2.id );
    });


    it( "emits on all operations", function( done ) {
        var ds = new Datastore();

        var actions = [];
        var m = new Model()
            .on( "saved", function() {
                actions.push( "s" );
            })
            .on( "loaded", function() {
                actions.push( "l" );
            })
            .on( "removed", function() {
                actions.push( "r" );
                done();
            });

        ds.save( m ).load( m ).remove( m );
    })
});


describe( "Field", function() {


    it( "it uses defaults", function() {

        var Dog = Model.extend( "Dog", {
            title: new blueprint.Field({})
        });

        assert.equal( new Dog().title, null );

        var Cat = Model.extend( "Cat", {
            title: new blueprint.Field({ default: "hello" })
        });

        assert.equal( new Cat().title, "hello" );

    });


    it( "required validation (by default)", function() {

        var Dog = Model.extend( "Dog", {
            title: new blueprint.Field()
        }).datastore( new Datastore() );

        assert.throws( function() { new Dog().save(); }, function( err ) {
            assert( err.message.match( /Validation\ Error/i ) );
            assert( err.message.match( /required/i ) );
            assert.equal( err.property, "title" );
            return err instanceof Error
        } );

        new Dog().extend({ title: "Rocky" }).save(); // no error

        var Cat = Model.extend( "Cat", {
            title: new blueprint.Field({ required: false })
        }).datastore( new Datastore() );

        new Cat().save(); // no error as it's not required

    });

});


describe( "String", function() {


    it( "verifies variable type", function() {

        var Dog = Model.extend( "Dog", {
            title: new blueprint.String()
        }).datastore( new Datastore() );

        var d = new Dog().extend({ title: 100 }); // invalid
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /not a string/i ) );
            return true;
        } );

        d.extend({ title: "cookie" });
        d.save(); // no errors

    });


    it( "minimum and maximum values", function() {
        var Dog = Model.extend( "Dog", {
            title: new blueprint.String({ min: 3, max: 5 })
        }).datastore( new Datastore() );

        var d = new Dog().extend({ title: "ab" });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /minimum/i ) );
            return true;
        } );

        d.extend({ title: "abcdef" });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /maximum/i ) );
            return true;
        } );

        d.extend({ title: "abcde" }).save(); // exactly 5 - no error
        d.extend({ title: "abc" }).save(); // exactly 3 - no error
    })


    it( "matches regexp", function() {
        var Dog = Model.extend( "Dog", {
            title: new blueprint.String({ regexp: /^[a-zA-Z].*/ })
        }).datastore( new Datastore() );

        var d = new Dog().extend({ title: "5ab" });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /regexp/i ) );
            return true;
        } );

        d.extend({ title: "ab5" }).save(); // no error
    } );

});


describe( "Number", function() {

    it( "verified variable type is a number", function() {
        var Dog = Model.extend( "Dog", {
            age: new blueprint.Number()
        }).datastore( new Datastore() );

        var d = new Dog().extend({ age: "hello" });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /not a number/i ) );
            return true;
        } );

        d.extend({ age: 5 }).save(); // no error
    } );


    it( "minimum and maximum values", function() {
        var Dog = Model.extend( "Dog", {
            age: new blueprint.Number({ min: 0, max: 20 })
        }).datastore( new Datastore() );

        var d = new Dog().extend({ age: -1 });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /minimum/i ) );
            return true;
        } );

        d.extend({ age: 21 });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /maximum/i ) );
            return true;
        } );

        d.extend({ age: 0 }).save();
         d.extend({ age: 20 }).save();

    });

});


describe( "List", function() {

    it( "verified variable type is an array", function() {
        var Dog = Model.extend( "Dog", {
            owners: new blueprint.List()
        }).datastore( new Datastore() );

        var d = new Dog().extend({ owners: 123 });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /not a list/i ) );
            return true;
        } );

        d.extend({ owners: [] }).save();
    });


    it( "minimum and maximum values", function() {
        var Dog = Model.extend( "Dog", {
            owners: new blueprint.List({ min: 1, max: 3 })
        }).datastore( new Datastore() );

        var d = new Dog().extend({ owners: [] });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /minimum/i ) );
            return true;
        } );

        d.extend({ owners: [ 1, 2, 3, 4 ] });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /maximum/i ) );
            return true;
        } );

        d.extend({ owners: [ 1 ] }).save();
        d.extend({ owners: [ 1, 2, 3 ] }).save();
    });


    it( "validates recursively the items in the list", function() {
        var Dog = Model.extend( "Dog", {
            nicknames: new blueprint.List({ of: new blueprint.String() })
        }).datastore( new Datastore() );


        var d = new Dog().extend({ nicknames: [ "rocky", 5 ] });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /not a string/i ) );
            return true;
        } );

        d.extend({ nicknames: [ "rocky", "browney" ] }).save();
    });
});


describe( "Boolean", function() {

    it( "verified variable type is a bool", function() {
        var Dog = Model.extend( "Dog", {
            happy: new blueprint.Boolean()
        }).datastore( new Datastore() );

        var d = new Dog().extend({ happy: "okay" });
        assert.throws( function() { d.save(); }, function( err ) {
            assert( err.message.match( /not a boolean/i ) );
            return true;
        } );

        d.extend({ happy: true }).save();
    });

});