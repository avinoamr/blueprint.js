var assert = require( "assert" );
var blueprint = require( "./blueprint" );

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