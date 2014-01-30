!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.tests=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){

// a utility method for merging objects (similar to underscore's _.extend() )
var merge = function( obj ) {
    for ( var i = 1 ; i < arguments.length ; i ++ ) {
        for ( var name in arguments[ i ] ) {
            obj[ name ] = arguments[ i ][ name ];
        }
    }
    return obj;
};

// Blueprint
var Blueprint = function Blueprint() {}
Blueprint.prototype.init = function() {};

Blueprint.prototype.extend = function( obj ) {
    return merge( this, obj );
};

Blueprint.prototype.toObject = function() {
    var obj = {};
    for ( var name in this ) {
        if ( this.hasOwnProperty( name ) ) {
            obj[ name ] = this[ name ];
        }
    }
    return obj;
};

var create = function( opts ) {
    this.extend( opts ).emit( "init" ).init();
};

Blueprint.extend = function( name ) {

    // create the named constructor
    var parent = this;
    var js = "function " + name + "(){return create.apply(this,arguments)};" + name;
    var ctor = eval( js );

    // most basic inheritance from the first parent
    // and then copy-prototype inheritence for every other parent
    var parents = [ this ];
    ctor.prototype = Object.create( parents[ 0 ].prototype );
    for ( var i = 1; i < arguments.length ; i += 1 ) {
        var proto = arguments[ i ];
        if ( typeof proto === "function" ) {
            parents.push( proto )
            proto = proto.prototype;
        }
        merge( ctor.prototype, proto );
    }

    // copy class members
    for ( var i = 0 ; i < parents.length ; i += 1 ) {
        merge( ctor, parents[ i ] );
    }

    // finally override the constructor setting to the first parent
    ctor.prototype.constructor = ctor;
    ctor.prototype.constructor.parents = parents;

    this.emit( "extend", ctor );
    return ctor;
};

/** Events **/
Blueprint.Events = {
    on: function( type, callback ) {
        this._listeners || ( this._listeners = {} );
        this._listeners[ type ] || ( this._listeners[ type ] = [] );
        this._listeners[ type ].push( callback );
        return this;
    },

    off: function( type, callback ) {
        if ( !this._listeners ) return this;
        if ( !this._listeners[ type ] ) return this;

        var i = 0;
        while ( -1 !== ( i = this._listeners[ type ].indexOf( callback ) ) ) {
            this._listeners[ type ].splice( i, 1 );
        }
        return this;
    },

    emit: function( type ) {
        if ( !this._listeners ) return this;
        if ( !this._listeners[ type ] ) return this;

        var args = [].slice.call( arguments, 1 );
        for ( var i = 0 ; i < this._listeners[ type ].length ; i += 1 ) {
            this._listeners[ type ][ i ].apply( this, args );
        }
        return this;
    }
};

merge( Blueprint.prototype, Blueprint.Events );
merge( Blueprint, Blueprint.Events );


/** Model **/
var Model = Blueprint.extend( "Model", {
    validate: function() {
        this.emit( "validate" );
        var schema = this.constructor.schema()
        for ( var prop in schema ) {
            schema[ prop ].validate( this[ prop ] );
        }
    },
    save: function() {
        this.validate();
        this.constructor.datastore().save( this );
        return this;
    },
    load: function() {
        this.constructor.datastore().load( this );
        return this;
    },
    remove: function() {
        this.constructor.datastore().remove( this );
        return this;
    }
});

Model.find = function( criteria ) {
    return this.datastore().find( this, criteria );
};

Model.datastore = function( ds ) {
    if ( arguments.length == 0 ) {
        var ds = this.prototype._datastore;
        if ( !ds ) {
            throw new Error( "No datastore has been assigned" );
        }
        return ds;
    } else if ( ds === null ) {
        delete this.prototype._datastore;
    } else {
        this.prototype._datastore = ds;
    }
    return this;
};

// extract the schema from the prototype, and replace it with the defaults
Model.on( "extend", function( ctor ) {
    var schema = {};
    for ( var prop in ctor.prototype ) {
        if ( !ctor.prototype.hasOwnProperty( prop ) ) {
            continue;
        }

        var v = ctor.prototype[ prop ];
        if ( v === String ) v = new StringField();
        else if ( v === Number ) v = new NumberField();
        else if ( v === Array ) v = new ListField();
        if ( !( v instanceof ModelField ) ) {
            continue; // not a field object
        }

        v.property = prop;
        ctor.prototype[ prop ] = v.default;
        schema[ prop ] = v;
    }
    ctor.schema = function() { return schema };
});

// a base model field with a required validator
var ModelField = Blueprint.extend( "Field", {
    name: null, required: true, default: null,
    assert: function( cond, msg ) {
        if ( !cond ) {
            var msg = "Validation Error (" + this.property + "): " + msg;
            var err = new Error( msg )
            err.property = this.property;
            err.validator = this.constructor;
            throw err
        }
    },
    validate: function( v ) {
        if ( !this.required ) return;
        this.assert( typeof v != "undefined" && v != null, "required" );
    }
});

var StringField = ModelField.extend( "String", {
    min: null, max: null, regexp: null,
    validate: function( v ) {
        ModelField.prototype.validate.apply( this, arguments );
        this.assert( typeof v === "string", "not a string" );
        if ( this.max ) {
            this.assert( v.length <= this.max, "Maximum " + this.max + " characters" );
        }
        if ( this.min ) {
            this.assert( v.length >= this.min, "Minimum " + this.max + " characters" );
        }
        if ( this.regexp ) {
            this.assert( v.match( this.regexp ) != null, "doesn't match regexp: " + this.regexp );
        }
    }
});

var NumberField = ModelField.extend( "Number", {
    min: null, max: null,
    validate: function( v ) {
        ModelField.prototype.validate.apply( this, arguments );
        this.assert( v instanceof Number || typeof v === "number", "not a number" );
        if ( this.min !== null ) {
            this.assert( v >= this.min, "Minimum is " + this.min );
        }
        if ( this.max !== null ) {
            this.assert( v <= this.max, "Maximum is " + this.max );
        }
    }
});

var BooleanField = ModelField.extend( "Boolean", {
    validate: function( v ) {
        ModelField.prototype.validate.apply( this, arguments );
        this.assert( v === true || v === false, "not a boolean" );
    }
});

var ListField = ModelField.extend( "List", {
    max: null, min: null, of: null,
    validate: function( v ) {
        ModelField.prototype.validate.apply( this, arguments );
        this.assert( v instanceof Array, "not a list or array" );
        if ( this.max !== null ) {
            this.assert( v.length <= this.max, "maximum of " + this.max + " items" );
        }
        if ( this.min !== null ) {
            this.assert( v.length >= this.min, "minimum of " + this.min + " items" );
        }
        if ( this.of !== null && this.of instanceof ModelField ) {
            for ( var i = 0 ; i < v.length ; i += 1 ) {
                this.of.validate( v[ i ] );
            }
        }
    }
});

/** Datastore **/
var Datastore = Blueprint.extend( "Datastore", {
    init: function( map ) {
        this.map || ( this.map = {} );
        Datastore.__id = 0;
    },

    key: function( model ) {
        return model.constructor.name + "." + model.id;
    },

    save: function( model ) {
        if ( !model.id ) {
            Datastore.__id += 1;
            model.id = Datastore.__id;
        }

        this.map[ this.key( model ) ] = model.toObject();
        model.emit( "saved" );
        return this;
    },

    load: function( model ) {
        var obj = this.map[ this.key( model ) ]
        if ( !obj ) {
            var err = new Error( "Unable to load model: not found" );
            return model.emit( "error", err );
        }
        model.extend( obj );
        model.emit( "loaded" );
        return this;
    },

    remove: function( model ) {
        delete this.map[ this.key( model ) ];
        model.emit( "removed" );
        return this;
    },
});

module.exports = {
    Blueprint: Blueprint,
    Model: Model,
    Datastore: Datastore,
    Field: ModelField,
    String: StringField,
    Number: NumberField,
    Boolean: BooleanField,
    Array: ListField,
    List: ListField,
};
},{}],2:[function(_dereq_,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = _dereq_('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":6}],3:[function(_dereq_,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],4:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],5:[function(_dereq_,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(_dereq_,module,exports){
(function (process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = _dereq_('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = _dereq_('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
}).call(this,_dereq_("/home/avinoamr/dev/blueprint.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":5,"/home/avinoamr/dev/blueprint.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":4,"inherits":3}],7:[function(_dereq_,module,exports){
var assert = _dereq_( "assert" );
var blueprint = _dereq_( ".." );

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
},{"..":1,"assert":2}]},{},[7])
(7)
});