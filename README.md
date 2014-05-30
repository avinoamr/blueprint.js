blueprint.js
============

A sleek and simple interface for building powerful Javascript classes

> Inspired by a brilliant [talk](https://www.youtube.com/watch?v=9LfmrkyP81M) by David Heinemeier Hansson (creator of Ruby on Rails), I started thinking about code clarity in Javascript, in what can be done to make the language more expressive and powerful, but also more concise. Blueprint is an attempt to focus on one aspect of code clarity: minimalistic single-purpose functions. This is achieved by borrowing Python's function decorators in order to separate side-effects and setup logic from the core intention of the function itself.

# Installation

```
$ npm install blueprint
```

# Usage

Create your Model classes by subclassing other Model classes:

```javascript
var Task = blueprint( "Task" )
    .define( "title", null )
    .define( "done", false )
    
    .static() // defines a static member on the class
    .define( "tasks", [] )
    
    // constructor
    .init(function( title ) {
        this.title = title;
        this.constructor.tasks.push( this )
    })
    
    .alias( "flip" )
    .define( "toggle", function() {
        this.done = !this.done;
        return this;
    })
    
    .trigger( "remove" ) // trigger the remove event before invocation
    .decorate( log ) // inline custom decoration for logging
    .define( "remove", function() {
        var tasks = this.constructor.tasks;
        var i = tasks.indexOf( this );
        tasks.splice( i, 1 );
    })
    
    .create(); // build and return the class from the Blueprint
```

Simply put, Blueprint is an API for constructing classes. Once the class is fully defined, call `.create()` to receive it's final constructor. You can also use it to extend external classes, like Backbone Models:

```javascript
var User = blueprint( Backbone.Model )
    .define( "defaults", { name: "", age: null } )
    
    .thenable() // makes save return a new Promise
    .define( "save", function( attrs, options, fulfill, reject ) {
        options || ( options = {} );
        options.success = function( model ) {
            fulfill( model );
        };
        options.error = function( model, err ) {
            reject( err );
        }
        Backbone.Model.prototype.save.call( this, attrs, options )
    })
    
    .create();
```

Blueprint encourages the use of Promises, instead of the traditional nesting callbacks. In the example above, we converted the save method to return a thenable object which can be accessed like this:

```javascript
new User({ name: "John", age: 29 })
    .save()
    .then(function(model) {
        // user is saved successfully
    })
    .catch(function(err) {
        // something went wrong
    });
```

Of course we can chain several thenable methods one after the other, using the `then()` directive, in order to flatten complex functions:

```javascript
var Settings = blueprint()
    
    .thenable()
    .define( "read", function( fulfill, reject ) {
        fs.readFile( "settings.json", function( err, data ) {
            if ( err ) reject( err )
            else fulfill( data )
        });
    })
    .then( String )
    .then( JSON.parse )
    
    .thenable()
    .then(function( data, fulfill, reject ) {
        data.lastopen = new Date().toString();
        fs.writeFile( "settings.json", JSON.stringify( data ), function( err ) {
            if ( err ) reject( err );
            else fulfill( data )
        })
    })
    
    .create()
```

## Decorators

Blueprint includes with the following built-in decorators:

#### .static()
Defines the next property on the class, instead of the prototype:

```javascript
blueprint()
    .static()
    .define( "hello", "world" )
    .create()
    .hello; // == "world"
```
    
#### .alias( name )
Defines an alias for the next property:

```javascript
blueprint()
    .alias( "foo" )
    .define( "bar", 15 )
    .create()
    .prototype.foo // == prototype.bar == 15
```

#### .bind( obj )
Defines the next method to run with the provided context, instead of the default instance as `this`:

```javascript
blueprint()
    .bind({ hello: "world" }) // can also be a function that returns the object
    .define( "foo", function() {
        return this.hello // returns "world"
    })
    .create()
```

#### .trigger( event_name )
Decorates the next method to trigger an event when before it's invoked:

```javascript
var Class = blueprint()
    .trigger( "hello" )
    .define( "world", function() {} )
    .create();
    
new Class()
    .on( "hello", function( ev, options ) {})
    .world();
```

#### .thenable()
Decorates the next method to return a Promise (the real return value is ignored) and also automatically appends callbacks for fulfilling and rejecting the promise. This is the Blueprint approach to building async code.

```javascript
var FileReader = blueprint()
    .thenable()
    .define( "readfile", function( fname, fulfill, reject ) {
        fs.readFile( fname, function( err, data ) {
            if ( err ) reject( err )
            else fulfill( data )
        });
    })
    .create();
    
new FileReader()
    .readfile( "hello" )
    .then(function( data ) {})
    .catch(function( err ) {});
```

#### Work in progress
The following decorators are intended to be included in Blueprint. Contributions are welcome:

1. `.private()` - private members
1. `.property()` - property getter/setter
1. `.expect()` - function input validation
1. `.overload()` - function overloading

## Custom Decorators

You can easily define your own custom decorators, using the `.decorate()` directive. Decorators, are simply functions that receive some previous defition of a property or method, and returns a new one:

```javascript
var log_decorator = function( name, fn ) {
    return function() {
        console.log( name, arguments );
        return fn.apply( this, arguments );
    }
};

var Class = blueprint()
    .decorate( log_decorator )
    .define( "hello", function() {})
    .create();
    
new Class().hello( 1, 2 ); // will log: "hello", [ 1, 2 ]
```

That's it. You can use decorators to augument the class in any possible way, especially for separating side-effects and different aspects of the code out of the core function/property. You can also define a named decorator for easy re-usability (beware of conflicts):

```javascript
blueprint()
    .decorate( "log", function() { return log_decorator } )
    
    .log()
    .define( "hello", function() {})
    
    .log()
    .define( "world", function() {})
    
    .create();
```

    





