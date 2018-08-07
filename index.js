'use strict';

var fs = require('fs');
var templateHandler = require('../../engine/templateHandler');
var domManipulator = require('../../engine/domManipulator');
var common = domManipulator.common;

var boardDescriptions = {};

try {
  var readContent = fs.readFileSync(__dirname + '/dont-reload/descriptions',
      'utf8');

  var lines = readContent.split('/n');

  for (var i = 0; i < lines.length; i++) {

    var line = lines[i];

    var split = line.indexOf(',');

    var board = line.substring(0, split).trim();

    var description = line.substring(split + 1).trim();

    boardDescriptions[board] = description;

  }

} catch (error) {
  console.log(error);
}

exports.engineVersion = '2.0';

exports.addMeta = function(content, key, keyValue, document) {

  var headTag = document.getElementsByTagName('head')[0];

  var metaTag = document.createElement('meta');
  metaTag.setAttribute(key, keyValue);
  metaTag.setAttribute('content', content);

  headTag.appendChild(metaTag);

};

exports.init = function() {

  var originalCheck = templateHandler.checkMainChildren;

  templateHandler.checkMainChildren = function(page, document) {

    if (page.template === 'threadPage' || page.template === 'boardPage') {
      exports.addMeta('__metaTitle_value__', 'property', 'og:title', document);
      exports.addMeta('__metaDescription_value__', 'property',
          'og:description', document);
    }

    return originalCheck(page, document);

  };

  var originalSetHeader = common.setHeader;

  common.setHeader = function(template, language, bData, flagData, thread) {

    var toRet = originalSetHeader(template, language, bData, flagData, thread);

    if (!thread) {

      toRet = toRet.replace('__metaTitle_value__', bData.boardName);

      var cleanedDescription = common.clean(boardDescriptions[bData.boardUri]);
      cleanedDescription = cleanedDescription || bData.boardDescription;

      toRet = toRet.replace('__metaDescription_value__', cleanedDescription);

    } else {

      var title;
      var description = common.clean(thread.message.substring(0, 128));

      if (thread.subject) {
        title = common.clean(thread.subject);
      } else {
        title = description;
      }

      toRet = toRet.replace('__metaTitle_value__', title);
      toRet = toRet.replace('__metaDescription_value__', description);

    }

    return toRet;

  };

};