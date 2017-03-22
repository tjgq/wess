var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var extend = require('extend');
var less = require('less');
var chokidar = require('chokidar');

module.exports = function(path, opts) {

  // Pass the original filename to less.render() for import path resolution.
  opts = extend({ filename: path }, opts || {});

  // Create a new EventEmitter to be returned.
  var emitter = new EventEmitter();

  // The set of watched files.
  var watchSet = new Set([path]);

  // Create the file system watcher.
  // Do not emit event when a file is added to the list, only when it changes.
  var watcher = chokidar.watch([...watchSet], { ignoreInitial: true });

  // Read the source file.
  function read(path) {
    return new Promise(function(resolve, reject) {
      fs.readFile(path, 'utf8', function(err, result) {
        err ? reject(err) : resolve(result);
      });
    });
  }

  // Compile the source.
  function compile(source) {
    return less.render(source, opts);
  }

  // Iterate all dependencies and update the watch set.
  function watch(result) {
    var newWatchSet = new Set([path].concat(result.imports));
    var filesToAdd = [...newWatchSet].filter((file) => !watchSet.has(file));
    var filesToRemove = [...watchSet].filter((file) => !newWatchSet.has(file));
    for (var file of filesToAdd) {
      watcher.add(file);
    }
    for (var file of filesToRemove) {
      watcher.unwatch(file);
    }
    watchSet = newWatchSet;
    return Promise.resolve(result);
  }

  // Recompile the source and update the watch list.
  // Emit an event to signal the compilation result.
  function update() {
    read(path).then(compile).then(watch).then(success).catch(failure);
  }

  function success(result) {
    emitter.emit('compile', result);
  }

  function failure(error) {
    emitter.emit('error', error);
  }

  // Stop watching.
  function close() {
    watcher.close();
  }

  // Recompile whenever a dependency changes.
  // Also emit an event signalling which file triggered the recompilation.
  watcher.on('all', function(event, path) {
    emitter.emit('change', path);
    update();
  });

  // Relay watch errors to the caller.
  watcher.on('error', function(err) {
    emitter.emit('error', err);
  });

  // Schedule the initial compilation to run once the main file is under watch.
  watcher.on('ready', update);

  return extend(emitter, {
    close: close
  });

};
