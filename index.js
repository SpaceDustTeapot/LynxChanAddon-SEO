'use strict';

var fs = require('fs');
var templateHandler = require('../../engine/templateHandler');
var domManipulator = require('../../engine/domManipulator');
var common = domManipulator.common;
var imageTagContent;

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

exports.setThread = function(thread, toRet) {

  if (thread.files && thread.files.length) {
    toRet = toRet.replace('__metaImage_location__', imageTagContent);

    toRet = toRet.replace('__metaImage_value__', thread.files[0].thumb);

  } else {
    toRet = toRet.replace('__metaImage_location__', '');
  }

  var title;
  var description = common.clean(thread.message.substring(0, 128));

  if (thread.subject) {
    title = common.clean(thread.subject);
  } else {
    title = description;
  }

  toRet = toRet.replace('__metaTitle_value__', title);
  return toRet.replace('__metaDescription_value__', description);

};

exports.init = function() {

  common.setUploadLinks = function(cell, file) {

    cell = cell.replace('__imgLink_href__', file.path);
    cell = cell.replace('__imgLink_mime__', file.mime);

    if (file.width) {
      cell = cell.replace('__imgLink_width__', file.width);
      cell = cell.replace('__imgLink_height__', file.height);
    } else {
      cell = cell.replace('data-filewidth="__imgLink_width__"', '');
      cell = cell.replace('data-fileheight="__imgLink_height__"', '');
    }

    cell = cell.replace('__nameLink_href__', file.path);

    var originalName = common.clean(file.originalName);

    var img = '<img src="' + file.thumb + '" title="' + originalName + '">';

    cell = cell.replace('__imgLink_children__', img);

    cell = cell.replace('__originalNameLink_inner__', originalName);
    cell = cell.replace('__originalNameLink_download__', originalName);
    cell = cell.replace('__originalNameLink_href__', file.path);

    return cell;

  };

  var originalCheck = templateHandler.checkMainChildren;

  templateHandler.checkMainChildren = function(page, document) {

    if (page.template === 'threadPage' || page.template === 'boardPage') {
      exports.addMeta('__metaTitle_value__', 'property', 'og:title', document);
      exports.addMeta('__metaDescription_value__', 'property',
          'og:description', document);
    }

    if (page.template === 'threadPage') {
      var headTag = document.getElementsByTagName('head')[0];

      var metaTag = document.createElement('meta');
      metaTag.setAttribute('property', 'og:image');
      metaTag.setAttribute('content', '__metaImage_value__');

      headTag.appendChild(metaTag);

      var textNode = document.createTextNode('__metaImage_location__');

      metaTag.parentNode.insertBefore(textNode, metaTag);

      imageTagContent = metaTag.outerHTML;
      metaTag.remove();

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

      return toRet.replace('__metaDescription_value__', cleanedDescription);

    } else {
      return exports.setThread(thread, toRet);
    }

  };

};