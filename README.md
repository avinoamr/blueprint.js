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
    user_id: Number,

    init: function( title ) {
        this.title = title;
    },

    toggle: function() {
        return this.extend({ done: !this.done });
    }
});
```

