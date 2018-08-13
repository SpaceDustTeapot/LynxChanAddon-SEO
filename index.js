'use strict';

var fs = require('fs');
var db = require('../../db');
var taskListener = require('../../taskListener');
var posting = require('../../engine/postingOps').thread;
var threads = db.threads();
var templateHandler = require('../../engine/templateHandler');
var domManipulator = require('../../engine/domManipulator');
var jit = require('../../engine/jitCacheOps');
var cache = require('../../engine/cacheHandler');
var common = domManipulator.common;
var imageTagContent;
var locks = {};
var cacheIndex = {};
var caches = {};

var boardDescriptions = {};
var domain = fs.readFileSync(__dirname + '/dont-reload/domain', 'utf8').trim();

try {
  var readContent = fs.readFileSync(__dirname + '/dont-reload/descriptions',
      'utf8');

  var lines = readContent.split('\n');

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

    var imagePath = domain + thread.files[0].thumb;
    toRet = toRet.replace('__metaImage_value__', imagePath);

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

exports.getThreadEntry = function(boardUri, threadData) {

  var toRet = '<url><loc>' + domain + '/' + boardUri + '/res/';
  toRet += threadData.threadId + '.html</loc><lastmod>';
  toRet += threadData.lastBump.toISOString().substring(0, 10);
  toRet += '</lastmod><changefreq>hourly</changefreq></url>';

  return toRet;

};

exports.generateBoardMap = function(lockData, callback) {

  threads.find({
    boardUri : lockData.boardUri
  }, {
    projection : {
      threadId : 1,
      lastBump : 1,
      _id : 0
    }
  }).toArray(function gotThreads(error, foundThreads) {

    if (error) {
      callback(error);
    } else {

      var children = '';

      for (var i = 0; i < foundThreads.length; i++) {

        var thread = foundThreads[i];

        children += exports.getThreadEntry(lockData.boardUri, thread);

      }

      // TODO
      var content = '<?xml version="1.0" encoding="UTF-8" ?>';
      content += '<urlset xmlns="http://www.sitemaps.org/schemas/';
      content += 'sitemap/0.9">';
      content += children + '</urlset> ';

      var path = '/' + lockData.boardUri + '/sitemap.xml';

      cache.writeData(content, path, 'text/xml', {
        boardUri : lockData.boardUri,
        type : 'sitemap'
      }, callback);

    }

  });

};

exports.initCacheHandling = function() {

  var originalReceiveGetLock = cache.receiveGetLock;

  cache.receiveGetLock = function(task, socket) {

    var lockData = task.lockData;

    if (lockData.type === 'sitemap') {
      cache.returnLock(task, lockData.boardUri, locks, socket);
    } else {
      originalReceiveGetLock(task, socket);
    }

  };

  var originalDeleteLock = cache.deleteLock;

  cache.deleteLock = function(task) {

    var lockData = task.lockData;

    if (lockData.type === 'sitemap') {
      delete locks[lockData.boardUri];
    } else {
      originalDeleteLock(task);
    }

  };

  var originalGetInfoToClear = cache.getInfoToClear;

  cache.getInfoToClear = function(task) {

    if (task.cacheType === 'sitemap') {

      var caches = cacheIndex[task.boardUri];

      if (!caches) {
        return;
      }

      return {
        object : cacheIndex,
        indexKey : task.boardUri
      };

    } else {
      return originalGetInfoToClear(task);
    }

  };

  var originalPlaceIndex = cache.placeIndex;

  cache.placeIndex = function(task) {

    if (task.meta.type === 'sitemap') {
      cache.pushIndex(cacheIndex, task.meta.boardUri, task.dest);
    } else {
      originalPlaceIndex(task);
    }

  };

};

exports.initJitHandling = function() {

  var originalGenerateCache = jit.generateCache;

  jit.generateCache = function(lockData, callback) {

    if (lockData.type === 'sitemap') {
      exports.generateBoardMap(lockData, callback);
    } else {
      originalGenerateCache(lockData, callback);
    }

  };

  var originalGetBoardLock = jit.getBoardLock;

  jit.getBoardLock = function(parts) {

    var toRet = originalGetBoardLock(parts);

    if (toRet) {
      return toRet;
    }

    if (parts.length === 3 && parts[2] === 'sitemap.xml') {
      return {
        boardUri : parts[1],
        type : 'sitemap'
      };
    }

  };

};

exports.init = function() {

  exports.initJitHandling();

  exports.initCacheHandling();

  var originalThreadCreation = posting.finishThreadCreation;

  posting.finishThreadCreation = function(boardData, threadId, enabledCaptcha,
      callback, thread) {

    taskListener.sendToSocket(null, {
      cacheType : 'sitemap',
      boardUri : boardData.boardUri,
      type : 'cacheClear'
    }, function sentMessage(error) {

      if (error) {
        callback(error);
      } else {

        originalThreadCreation(boardData, threadId, enabledCaptcha, callback,
            thread);

      }

    });

  };

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
      exports.addMeta('__metaDescription_value__', 'name',
          'description', document);

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
