const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const wess = require('../lib/wess');

// Failed assertions in event handlers cannot be caught by the test runner
// since they live a different call stack. This function arranges for them
// to be called in the test's stack frame.
function waitForEvent(emitter, event, done) {
  let args;
  const spy = function() {
    args = arguments;
  };
  const timer = setInterval(function() {
    if (args) {
      clearInterval(timer);
      done.apply(null, args);
    }
  }, 10);
  emitter.once(event, spy);
}

describe('wess', () => {

  it('should compile file without import', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    fs.writeFileSync(mainPath, '#a { color: #aaa }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      assert(/#a/.test(result.css));
      done();
    });
  });

  it('should compile file with import', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    const depPath = path.join(dirPath, 'dep.less');
    fs.writeFileSync(mainPath, '@import "dep.less"; #a { color: #aaa }');
    fs.writeFileSync(depPath, '#b { color: #bbb }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      assert(/#b[\s\S]*#a/.test(result.css));
      done();
    });
  });

  it('should recompile when the main file changes', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    fs.writeFileSync(mainPath, '#a { color: #aaa }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'compile', (result) => {
        assert(/#b/.test(result.css));
        done();
      });
    });
    fs.writeFileSync(mainPath, '#b { color: #bbb }');
  });

  it('should recompile when the imported file changes', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    const depPath = path.join(dirPath, 'dep.less');
    fs.writeFileSync(mainPath, '@import "dep.less"; #a { color: #aaa }');
    fs.writeFileSync(depPath, '#b { color: #bbb }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'compile', (result) => {
        assert(/#c[\s\S]*#a/.test(result.css));
        done();
      });
      fs.writeFileSync(depPath, '#c { color: #ccc }');
    });
  });

  it('should unwatch file when it ceases to be imported', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    const depPath = path.join(dirPath, 'dep.less');
    fs.writeFileSync(mainPath, '@import "dep.less"; #a { color: #aaa }');
    fs.writeFileSync(depPath, '#b { color: #bbb }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'compile', (result) => {
        assert(!/#b/.test(result.css));
        waitForEvent(watcher, 'compile', (result) => {
          assert(false);
        });
        fs.writeFileSync(depPath, '#d { color: #ddd }');
        setTimeout(done, 500);
      });
      fs.writeFileSync(mainPath, '#c { color: #ccc }');
    });
  });

  it('should watch file when it becomes imported again', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    const depPath = path.join(dirPath, 'dep.less');
    fs.writeFileSync(mainPath, '@import "dep.less"; #a { color: #aaa }');
    fs.writeFileSync(depPath, '#b { color: #bbb }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'compile', (result) => {
        waitForEvent(watcher, 'compile', (result) => {
          assert(/#b[\s\S]*#a/.test(result.css));
          done();
        });
        fs.writeFileSync(mainPath, '@import "dep.less"; #a { color: #aaa }');
      });
      fs.writeFileSync(mainPath, '#c { color: #ccc }');
    });
  });

  it('should report an error', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    fs.writeFileSync(mainPath, '#a { color: #aaa }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'compile', (result) => {
        assert(false);
      });
      waitForEvent(watcher, 'error', (err) => {
        done();
      });
      fs.writeFileSync(mainPath, '#a { ');
    });
  });

  it('should compile again after an error', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    fs.writeFileSync(mainPath, '#a { color: #aaa }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      waitForEvent(watcher, 'error', (err) => {
        waitForEvent(watcher, 'compile', (result) => {
          assert(/#b/.test(result.css));
          done();
        });
        fs.writeFileSync(mainPath, '#b { color: #bbb }');
      });
      fs.writeFileSync(mainPath, '#a { ');
    });
  });

  it('should close', (done) => {
    const dirPath = tmp.dirSync().name;
    const mainPath = path.join(dirPath, 'main.less');
    fs.writeFileSync(mainPath, '#a { color: #aaa }');
    const watcher = wess(mainPath);
    waitForEvent(watcher, 'compile', (result) => {
      watcher.close();
      waitForEvent(watcher, 'compile', (result) => {
        assert(false);
      });
      fs.writeFileSync(mainPath, '#b { color: #bbb }');
      setTimeout(done, 500);
    });
  });
});
