var assert = require( "assert" );
var Blueprint = require( "./blueprint" ).Blueprint;

describe( "blueprint", function() {

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