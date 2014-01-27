blueprint.js
============

A database agnostic model layer and classic OOP implementation designed for
reusability between the client and server.

> While there are many ORM libraries out there, it's difficult to find one that
allows reusability between the client and server. A model layer, representing
the core business logic of the application, should have no context, and can
therefor have the same representation on the client as it does on the server
with the exception of the persistence layer. Blueprint is designed specifically
for this architecture: create one model - reuse it everywhere. Oh, and there's
also a minimalistic OOP implementation underneath.

## Installation

```
$ npm install blueprint
```

# Usage

Subclass Model classes to create your concrete classes:

```javascript
var Task = blueprint.Model.extend( "Task", {
    title: String,
    done: Boolean,

    init: function( title ) {
        this.title = title;
    },

    toggle: function() {
        return this.extend({ done: !this.done }).save(); // borrowed
    }
});
```



```javascript
var Blueprint = require( "blueprint" ).Blueprint; // or -- window.blueprint.Blueprint
var Task = Blueprint.extend( "Task", {
    title: "untitled", // defaults
    done: false,

    init: function( title ) {
        this.title = title;
    },


});

var task = new Task( "Buy milk" ).toggle(); // check!
```

This is the most basic way to create a Blueprint object. It also supports
multiple inheritance:

```javascript
var ScheduledTask = Task.extend( "ScheduledTask", {
    eta: null,

    init: function( title, eta ) {
        Task.prototype.call( this, title ); // super call... we can do better.
        this.eta = eta;
    }
})
```


# Datastore

