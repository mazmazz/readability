/* Change basePath as necessary!
 * Script loading: https://stackoverflow.com/a/6235308
 * Bookmarkleter: http://bookmarklets.org/maker/ */

(function() {
  var basePath = '//rawgit.com/mazmazz/readability/master';
  var callback = function() {
    try {
      var r = new ReadabilityApp(basePath);

      r.getDom(document.cloneNode(true)).then(
        function(newDom) {
          var newWindow = window.open('about:blank','_blank');
          var loadWindow = function() {
            newWindow.document.head.innerHTML = newDom.head.innerHTML;
            newWindow.document.body.outerHTML = newDom.body.outerHTML;
          };
          if (typeof InstallTrigger !== 'undefined') { // firefox hack
            newWindow.onload = loadWindow;
          }
          else {
            loadWindow();
          }
        },
        function (e) {
          alert('Readability error: ' + e);
        }
      );
    }
    catch (e) {
      alert('Readability error: ' + e);
    }
  };
    // check for our library existence
  if (typeof (ReadabilityApp) == 'undefined') {
    var sources = [
      basePath + '/Readability.js',
      basePath + '/app/readabilityApp.js'];

    var loadNextScript = function() {
      if (sources.length > 0) {
        var script = document.createElement('script');
        script.src = sources.shift();
        document.body.appendChild(script);

        var done = false;
        script.onload = script.onreadystatechange = function() {
          if (!done
              && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
            done = true;

            // Handle memory leak in IE
            script.onload = script.onreadystatechange = null;

            loadNextScript();
          }
        }
      } else {
        callback();
      }
    }
    loadNextScript();

  } else {
    callback();
  }
})();
