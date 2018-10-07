/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Perform Readability in a Promise and wrap output into content HTML */

/**
 * Public constructor.
 */
function ReadabilityApp(basePath) {
  if (typeof(basePath) == 'string') {
    this.CONTENT_HEAD_PATH = basePath + this.CONTENT_HEAD_PATH;
    this.CONTENT_BODY_PATH = basePath + this.CONTENT_BODY_PATH;
    this.CONTENT_SCRIPT_PATH = basePath + this.CONTENT_SCRIPT_PATH;
    this.CONTENT_STYLE_PATH = basePath + this.CONTENT_STYLE_PATH;
    this.CONTENT_STYLE_MOBILE_PATH = basePath + this.CONTENT_STYLE_MOBILE_PATH;
  }
}

ReadabilityApp.prototype = {
  SETTING_BODY_COLOR: 'dark', // <body> .dark; .light; .sepia
  SETTING_FONT_STYLE: 'sans-serif', // <body> .sans-serif; .serif
  SETTING_FONT_SIZE: 5, // .container .font-size5
  SETTING_CONTENT_WIDTH: 3, // .container .content-width3
  SETTING_LINE_HEIGHT: 4, // .moz-reader-content .line-height4

  CONTENT_HEAD_PATH: '/content/aboutReader-head.html',
  CONTENT_BODY_PATH: '/content/aboutReader-body.html',
  CONTENT_SCRIPT_PATH: '/content/aboutReader.js',
  CONTENT_STYLE_PATH: '/content/aboutReader.css',
  CONTENT_STYLE_MOBILE_PATH: '/content/aboutReader-mobile.css',

  CONTENT_HEAD_SOURCE: null,
  CONTENT_BODY_SOURCE: null,

  _request: function (method, url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(xhr.response);
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send();
    });
  },

  _getContentSource: function() {
    let parent = this;
    return new Promise(function(resolve, reject) {
      if (!parent.CONTENT_HEAD_SOURCE || !parent.CONTENT_BODY_SOURCE) {
        Promise.all([
          parent._request('GET', parent.CONTENT_HEAD_PATH).then(
            function (resp) {
              parent.CONTENT_HEAD_SOURCE = resp;
            },
            function (e) {
              reject(e.status + ' - ' + e.statusText);
            }
          ),
          parent._request('GET', parent.CONTENT_BODY_PATH).then(
            function (resp) {
              parent.CONTENT_BODY_SOURCE = resp;
            },
            function (e) {
              reject(e.status + ' - ' + e.statusText);
            }
          ),
        ]).then(
          function () {
            resolve([parent.CONTENT_HEAD_SOURCE, parent.CONTENT_BODY_SOURCE]);
          },
          function (e) {
            reject(e.status + ' - ' + e.statusText);
          }
        );
      }
      else {
        resolve([parent.CONTENT_HEAD_SOURCE, parent.CONTENT_BODY_SOURCE]);
      }
    });
  },

  _fillContentSource: function(article, contentHeadSource, contentBodySource) {
    let contentDom = document.implementation.createHTMLDocument();

    contentDom.body.innerHTML = contentBodySource;
    contentDom.head.innerHTML = contentHeadSource;

    contentDom.getElementById('content-css').setAttribute('href', this.CONTENT_STYLE_PATH);
    //contentDom.getElementById('content-css-mobile').setAttribute('href', this.CONTENT_STYLE_PATH_MOBILE);
    contentDom.getElementById('content-script').setAttribute('src', this.CONTENT_SCRIPT_PATH);

    // Initialize reader appearance
    let containerNode = contentDom.getElementsByClassName('container')[0];
    contentDom.body.classList.add('loaded');
    contentDom.body.classList.add(this.SETTING_BODY_COLOR, this.SETTING_FONT_STYLE);
    containerNode.classList.add('font-size' + this.SETTING_FONT_SIZE, 'content-width' + this.SETTING_CONTENT_WIDTH);
    // line-height: See contentNode below

    // Fill header
    if (typeof(article) == 'object') {
      let domainNode = contentDom.getElementsByClassName('reader-domain')[0];
      domainNode.setAttribute('href', window.location.href);
      domainNode.innerHTML = window.location.hostname;

      let titleNode = contentDom.getElementsByClassName('reader-title')[0];
      titleNode.innerHTML = article.title;

      let creditsNode = contentDom.getElementsByClassName('reader-credits')[0];
      creditsNode.innerHTML = article.byline;

      //let lengthNode = contentDom.getElementsByClassName('reader-estimated-time')[0];
      //lengthNode.innerHTML = article.length;

      //let abstractNode = contentDom.getElementsByClassName('reader-abstract')[0];
      //abstractNode.innerHTML = article.excerpt;

      let headerNode = contentDom.getElementsByClassName('reader-header')[0];
      headerNode.classList.add('reader-show-element');
    }

    // Fill content
    let contentNode = contentDom.getElementsByClassName('moz-reader-content')[0];
    contentNode.innerHTML = (typeof(article) == 'object') ? article.content : article; // assume string
    contentNode.classList.add('reader-show-element');
    // Also initialize line height
    contentNode.classList.add('line-height' + this.SETTING_LINE_HEIGHT);

    // Fill title, priority: Article title, document title, content substring, 'Article'
    let titleNode = contentDom.getElementById('content-title');
    titleNode.innerHTML = (typeof(article) == 'object') ?
      ((article.title.length > 0) ? article.title : ((document.title.length > 0) ? document.title : 'Article'))
      : ((typeof(article) == 'string') ? (article.substring(0, 100) + ((article.length > 100) ? '&#8230;' : '')) : 'Article');

    return contentDom;
  },

  _doOutput: function(article) {
    let parent = this;
    return new Promise(function(resolve, reject) {
      parent._getContentSource().then(
        function (contentSources) {
          try {
            resolve(parent._fillContentSource(article, contentSources[0], contentSources[1]));
          }
          catch (e) {
            reject('Readability content source error: ' + e);
          }
        },
        function (e) {
          reject('Readability content source error: ' + e);
        }
      );
    });
  },

  _parsePromise: function(read) {
    return new Promise(function(resolve, reject) {
      try {
        resolve(read.parse());
      }
      catch(e) {
        reject(e);
      }
    });
  },

  /*
   * @param {HTMLDocument} doc     The document to parse.
   *     Can also be an HTML string that will be passed to Readability
   *     or a plain text string that will be HTML-formatted and inserted as-is.
   * @param {Object}       options The options object, passed to Readability.
   */
  getDom: function(doc, options) {
    let parent = this;
    return new Promise(function(resolve, reject) {
      if (typeof (Readability) == 'undefined') {
        reject('Readability is not loaded');
      }

      let read = new Readability(doc, options);

      if (!read.isProbablyReaderable()) {
        reject('Document is not Readerable');
      }

      parent._parsePromise(read).then(
        function(article) {
          parent._doOutput(article).then(
            function (newDom) {
              resolve(newDom);
            },
            function (e) {
              reject(e);
            }
          );
        },
        function (e) {
          reject(e);
        }
      );
    });
  },
};