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

# Installation

```
$ npm install blueprint
```

# Usage

Create your Model classes by subclassing other Model classes:

```javascript
var Task = blueprint.Model.extend( "Task", {
    title: String,
    done: Boolean,
    user_id: Number,

    init: function( title ) {
        this.user_id = 42;
    },

    toggle: function() {
        return this.extend({ done: !this.done });
    }
});
```

Attach a Datastore to the Model. A Datastore is an adapter that interacts with 
a specific database in order to save models to that database or read models from
it. Blueprint includes a simple in-memory datastore, which can be easily be
extended for other databases:


```javascript
blueprint.Model.datastore( new blueprint.Datastore() );
```

You are encouraged to subclass from the Datastore class, implement the `save()`,
`find()` and `remove()` methods, and use it for your projects - or share it with
me and I'll add a link to it here.



