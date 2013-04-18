/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { pathFor } = require('sdk/system');
const file = require("sdk/io/file");
const url = require("sdk/url");

const byteStreams = require("sdk/io/byte-streams");
const textStreams = require("sdk/io/text-streams");

const ERRORS = {
  FILE_NOT_FOUND: /^path does not exist: .+$/,
  NOT_A_DIRECTORY: /^path is not a directory: .+$/,
  NOT_A_FILE: /^path is not a file: .+$/,
};

// Use profile directory to list / read / write files.
const profilePath = pathFor('ProfD');
const fileNameInProfile = 'compatibility.ini';
const dirNameInProfile = 'extensions';
const filePathInProfile = file.join(profilePath, fileNameInProfile);
const dirPathInProfile = file.join(profilePath, dirNameInProfile);

exports.testDirName = function(test) {
  test.assertEqual(file.dirname(dirPathInProfile), profilePath,
                   "file.dirname() of dir should return parent dir");

  test.assertEqual(file.dirname(filePathInProfile), profilePath,
                   "file.dirname() of file should return its dir");

  let dir = profilePath;
  while (dir)
    dir = file.dirname(dir);

  test.assertEqual(dir, "",
                   "dirname should return empty string when dir has no parent");
};

exports.testBasename = function(test) {
  // Get the top-most path -- the path with no basename.  E.g., on Unix-like
  // systems this will be /.  We'll use it below to build up some test paths.
  // We have to go to this trouble because file.join() needs a legal path as a
  // base case; join("foo", "bar") doesn't work unfortunately.
  let topPath = profilePath;
  let parentPath = file.dirname(topPath);
  while (parentPath) {
    topPath = parentPath;
    parentPath = file.dirname(topPath);
  }

  let path = topPath;
  test.assertEqual(file.basename(path), "",
                   "basename should work on paths with no components");

  path = file.join(path, "foo");
  test.assertEqual(file.basename(path), "foo",
                   "basename should work on paths with a single component");

  path = file.join(path, "bar");
  test.assertEqual(file.basename(path), "bar",
                   "basename should work on paths with multiple components");
};

exports.testExtension = function(test) {
    test.assertEqual(file.extension(filePathInProfile), "ini", "extension of compatibility.ini should be 'ini'");
    test.assertEqual(file.extension(file.join(profilePath, "foo.bar.baz")), "baz", "extension of foo.bar.baz should be 'baz'");
}

exports.testLastModified = function(test) {
    var d = file.lastModified(filePathInProfile);
    test.assertEqual(typeof d, "object", "type of the value of lastModified");
}

exports.testList = function(test) {
  let list = file.list(profilePath);
  let found = [ true for each (name in list)
                    if (name === fileNameInProfile) ];

  if (found.length > 1)
    test.fail("a dir can't contain two files of the same name!");
  test.assertEqual(found[0], true, "file.list() should work");

  test.assertRaises(function() {
    file.list(filePathInProfile);
  }, ERRORS.NOT_A_DIRECTORY, "file.list() on non-dir should raise error");

  test.assertRaises(function() {
    file.list(file.join(dirPathInProfile, "does-not-exist"));
  }, ERRORS.FILE_NOT_FOUND, "file.list() on nonexistent should raise error");
};

exports.testRead = function(test) {
  let contents = file.read(filePathInProfile);
  test.assertMatches(contents, /Compatibility/,
                     "file.read() should work");

  test.assertRaises(function() {
    file.read(file.join(dirPathInProfile, "does-not-exists"));
  }, ERRORS.FILE_NOT_FOUND, "file.read() on nonexistent file should throw");

  test.assertRaises(function() {
    file.read(dirPathInProfile);
  }, ERRORS.NOT_A_FILE, "file.read() on dir should throw");
};


exports.testSeparator = function(test) {
  test.assert(file.separator == '/' || file.separator == '\\',
              "file.separator should give a separator");
};

exports.testJoin = function(test) {
  let baseDir = file.dirname(filePathInProfile);

  test.assertEqual(file.join(baseDir, fileNameInProfile),
                   filePathInProfile, "file.join() should work");
};

exports.testSplit = function (test) {
    var fileComp = file.split(filePathInProfile);
    test.assert(Array.isArray(fileComp), "Result of split should be an array");
    test.assert(fileComp.length > 3, "array should have at least 3 elements (mozilla dir, the profile dir, 'compatibility.ini')")
    test.assertEqual(fileComp.pop(), "compatibility.ini");
}


exports.testOpenNonexistentForRead = function (test) {
  var filename = file.join(profilePath, 'does-not-exists');
  test.assertRaises(function() {
    file.open(filename);
  }, ERRORS.FILE_NOT_FOUND, "file.open() on nonexistent file should throw");

  test.assertRaises(function() {
    file.open(filename, "r");
  }, ERRORS.FILE_NOT_FOUND, "file.open('r') on nonexistent file should throw");

  test.assertRaises(function() {
    file.open(filename, "zz");
  }, ERRORS.FILE_NOT_FOUND, "file.open('zz') on nonexistent file should throw");
};

exports.testOpenNonexistentForWrite = function (test) {
  let filename = file.join(profilePath, 'open.txt');

  let stream = file.open(filename, "w");
  stream.close();

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");
  file.remove(filename);
  test.assert(!file.exists(filename),
              "file.exists() should return false after file.remove()");

  stream = file.open(filename, "rw");
  stream.close();

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('rw')");
  file.remove(filename);
  test.assert(!file.exists(filename),
              "file.exists() should return false after file.remove()");
};

exports.testChangeWorkingDirectory = function (test) {
  let filename = file.join(profilePath, 'open.txt');
  let currDir = file.workingDirectory();

  file.changeWorkingDirectory(profilePath);

  let stream = file.open('open.txt', "w");
  stream.close();

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");
  file.remove(filename);

  file.changeWorkingDirectory(currDir);
};

exports.testOpenDirectory = function (test) {
  let dir = dirPathInProfile;
  test.assertRaises(function() {
    file.open(dir);
  }, ERRORS.NOT_A_FILE, "file.open() on directory should throw");

  test.assertRaises(function() {
    file.open(dir, "w");
  }, ERRORS.NOT_A_FILE, "file.open('w') on directory should throw");
};

exports.testOpenTypes = function (test) {
  let filename = file.join(profilePath, 'open-types.txt');


  // Do the opens first to create the data file.
  var stream = file.open(filename, "w");
  test.assert(stream instanceof textStreams.TextWriter,
              "open(w) should return a TextWriter");
  stream.close();

  stream = file.open(filename, "wb");
  test.assert(stream instanceof byteStreams.ByteWriter,
              "open(wb) should return a ByteWriter");
  stream.close();

  stream = file.open(filename, "a");
  test.assert(stream instanceof textStreams.TextWriter,
              "open(a) should return a TextWriter");
  stream.close();

  stream = file.open(filename, "ab");
  test.assert(stream instanceof byteStreams.ByteWriter,
              "open(a) should return a ByteWriter");
  stream.close();

  stream = file.open(filename, "wa");
  test.assert(stream instanceof textStreams.TextWriter,
              "open(wa) should return a TextWriter");
  stream.close();

  stream = file.open(filename, "wab");
  test.assert(stream instanceof byteStreams.ByteWriter,
              "open(wa) should return a TextWriter");
  stream.close();

  stream = file.open(filename);
  test.assert(stream instanceof textStreams.TextReader,
              "open() should return a TextReader");
  stream.close();

  stream = file.open(filename, "r");
  test.assert(stream instanceof textStreams.TextReader,
              "open(r) should return a TextReader");
  stream.close();

  stream = file.open(filename, "b");
  test.assert(stream instanceof byteStreams.ByteReader,
              "open(b) should return a ByteReader");
  stream.close();

  stream = file.open(filename, "rb");
  test.assert(stream instanceof byteStreams.ByteReader,
              "open(rb) should return a ByteReader");
  stream.close();

  file.remove(filename);
};

exports.testReadWrite = function (test) {
  let filename = file.join(profilePath, 'open.txt');

  file.write(filename, "Hello ReadWrite");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");

  let content = file.read(filename);
  test.assertEqual(content, "Hello ReadWrite", "file should contain the content written before");

  file.write(filename, " and WriteAppend", "a");

  content = file.read(filename);
  test.assertEqual(content, "Hello ReadWrite and WriteAppend", "file should contain the content appended before");

  file.remove(filename);
}


exports.testBinaryReadWrite = function (test) {
  let filename = file.join(profilePath, 'open.txt');

  file.write(filename, "ABC", "b");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");

  let content = file.read(filename, "b");
  test.assertEqual(content, "ABC", "file should contain the content written before");

  file.write(filename, "DEF", "ba");
  content = file.read(filename, "b");
  test.assertEqual(content, "ABCDEF", "file should contain the content appended before");

  file.remove(filename);
}

exports.testReadWriteWithStream = function (test) {
  let filename = file.join(profilePath, 'open.txt');

  let stream = file.open(filename, "w");
  stream.write("Hello ReadWriteWithStream");
  stream.close();

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");

  stream = file.open(filename, "r");
  let content = stream.read();
  stream.close();
  test.assertEqual(content, "Hello ReadWriteWithStream", "file should contain the content written before");

  stream = file.open(filename, "a");
  stream.write(" and with appended content");
  stream.close();

  stream = file.open(filename, "r");
  content = stream.read();
  stream.close();
  test.assertEqual(content, "Hello ReadWriteWithStream and with appended content", "file should contain the content appended before");

  file.remove(filename);
}

exports.testBinaryReadWriteWithStream = function (test) {
  let filename = file.join(profilePath, 'open.txt');

  let stream = file.open(filename, "wb");
  stream.write("Hello ReadWriteWithStream");
  stream.close();

  test.assert(file.exists(filename),
              "file.exists() should return true after file.open('w')");

  stream = file.open(filename, "rb");
  let content = stream.read();
  stream.close();
  test.assertEqual(content, "Hello ReadWriteWithStream", "file should contain the content written before");

  file.remove(filename);
}


exports.testMakeDirectoryRmdir = function (test) {
  let basePath = profilePath;
  let dirs = [];
  for (let i = 0; i < 3; i++)
    dirs.push("test-file-dir");

  let paths = [];
  for (let i = 0; i < dirs.length; i++) {
    let args = [basePath].concat(dirs.slice(0, i + 1));
    paths.unshift(file.join.apply(null, args));
  }

  for (let i = 0; i < paths.length; i++) {
    test.assert(!file.exists(paths[i]),
                "Sanity check: path should not exist: " + paths[i]);
  }

  test.assertRaises(function() file.makeDirectory(paths[0]),
                    /^The parent directory does not exist$/,
                    "makeDirectory on inexistant parent directory should raise error");

  for (let i = paths.length-1; i >= 0 ; i--) {
    file.makeDirectory(paths[i]);
  }

  test.assert(file.exists(paths[0]), "makeDirectory should create path: " + paths[0]);

  for (let i = 0; i < paths.length; i++) {
    file.rmdir(paths[i]);
    test.assert(!file.exists(paths[i]),
                "rmdir should remove path: " + paths[i]);
  }
};


exports.testMakeTreeRemoveTree = function (test) {
  let basePath = profilePath;
  let dirs = [];
  for (let i = 0; i < 3; i++)
    dirs.push("test-file-dir");

  let paths = [];
  for (let i = 0; i < dirs.length; i++) {
    let args = [basePath].concat(dirs.slice(0, i + 1));
    paths.unshift(file.join.apply(null, args));
  }

  for (let i = 0; i < paths.length; i++) {
    test.assert(!file.exists(paths[i]),
                "Sanity check: path should not exist: " + paths[i]);
  }

  file.makeTree(paths[0]);
  test.assert(file.exists(paths[0]), "mkpath should create path: " + paths[0]);

  file.removeTree(paths[2]);
  test.assert(!file.exists(paths[2]), "removeTree should delete path and its children: " + paths[2]);
};

exports.testMkpathTwice = function (test) {
  let dir = profilePath;
  let path = file.join(dir, "test-file-dir");
  test.assert(!file.exists(path),
              "Sanity check: path should not exist: " + path);
  file.mkpath(path);
  test.assert(file.exists(path), "mkpath should create path: " + path);
  file.mkpath(path);
  test.assert(file.exists(path),
              "After second mkpath, path should still exist: " + path);
  file.rmdir(path);
  test.assert(!file.exists(path), "rmdir should remove path: " + path);
};

exports.testMkpathExistingNondirectory = function (test) {
  var fname = file.join(profilePath, 'conflict.txt');
  file.open(fname, "w").close();
  test.assert(file.exists(fname), "File should exist");
  test.assertRaises(function() file.mkpath(fname),
                    /^The path already exists and is not a directory: .+$/,
                    "mkpath on file should raise error");
  file.remove(fname);
};

exports.testRmdirNondirectory = function (test) {
  var fname = file.join(profilePath, 'not-a-dir')
  file.open(fname, "w").close();
  test.assert(file.exists(fname), "File should exist");
  test.assertRaises(function() {
    file.rmdir(fname);
  }, ERRORS.NOT_A_DIRECTORY, "rmdir on file should raise error");
  file.remove(fname);
  test.assert(!file.exists(fname), "File should not exist");
  test.assertRaises(function () file.rmdir(fname),
                    ERRORS.FILE_NOT_FOUND,
                    "rmdir on non-existing file should raise error");
};

exports.testRmdirNonempty = function (test) {
  let dir = profilePath;
  let path = file.join(dir, "test-file-dir");
  test.assert(!file.exists(path),
              "Sanity check: path should not exist: " + path);
  file.mkpath(path);
  let filePath = file.join(path, "file");
  file.open(filePath, "w").close();
  test.assert(file.exists(filePath),
              "Sanity check: path should exist: " + filePath);
  test.assertRaises(function () file.rmdir(path),
                    /^The directory is not empty: .+$/,
                    "rmdir on non-empty directory should raise error");
  file.remove(filePath);
  file.rmdir(path);
  test.assert(!file.exists(path), "Path should not exist");
};

exports.testCopy = function(test) {
  let filename = file.join(profilePath, 'open.txt');
  let filename2 = file.join(profilePath, 'open2.txt');

  file.write(filename, "Hello testCopy");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.write");

  file.copy(filename, filename2);

  test.assert(file.exists(filename2),
              "file.exists() should return true after file.copy");
  
  let content = file.read(filename2);
  test.assertEqual(content, "Hello testCopy", "copy of the file should contain the same content as the source file");

  file.remove(filename);
  file.remove(filename2);
}

exports.testCopyTree = function(test) {
  function getCopyTreeFiles(rootName) {
    let dir1 = file.join(profilePath, rootName, "subtree", "subsubtree");
    let dir2 = file.join(profilePath, rootName, "subtree", "subsubtree2");
    let dir3 = file.join(profilePath, rootName, "subtree2");
    let dir4 = file.join(profilePath, rootName, "subtree");
    let dir5 = file.join(profilePath, rootName);
    let filename6 = file.join(dir5, 'fileInRootTree.txt');
    let filename7 = file.join(dir4, 'fileInSubTree.txt');
    let filename8 = file.join(dir3, 'fileInSubTree2.txt');
    let filename9 = file.join(dir1, 'fileInSubSubTree.txt');
    return ["", dir1, dir2, dir3, dir4, dir5, filename6, filename7, filename8, filename9];
  }

  let targetDir = file.join(profilePath, "newroottree");
  let srcFiles = getCopyTreeFiles("roottree");
  file.makeTree(srcFiles[1]);
  file.makeTree(srcFiles[2]);
  file.makeTree(srcFiles[3]);

  file.write(srcFiles[6], "Hello file in roottree");
  file.write(srcFiles[7], "Hello file in subtree");
  file.write(srcFiles[8], "Hello file in subtree2");
  file.write(srcFiles[9], "Hello file in subsubtree");

  file.copyTree(srcFiles[5], targetDir);

  let tgtFiles = getCopyTreeFiles("newroottree");

  test.assert(file.exists(tgtFiles[1]),
              "subsubtree should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[2]),
              "subsubtree2 should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[3]),
              "subtree2 should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[6]),
              "fileInRootTree.txt should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[7]),
              "fileInSubTree.txt should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[8]),
              "fileInSubTree2.txt should exists in newroottree after file.copyTree");
  test.assert(file.exists(tgtFiles[9]),
              "fileInSubSubTree.txt should exists in newroottree after file.copyTree");

  let content = file.read(tgtFiles[6]);
  test.assertEqual(content, "Hello file in roottree", "copy of fileInRootTree.txt should contain the same content as the source file");

  content = file.read(tgtFiles[7]);
  test.assertEqual(content, "Hello file in subtree", "copy of fileInSubTree.txt should contain the same content as the source file");

  content = file.read(tgtFiles[8]);
  test.assertEqual(content, "Hello file in subtree2", "copy of fileInSubTree2.txt should contain the same content as the source file");

  content = file.read(tgtFiles[9]);
  test.assertEqual(content, "Hello file in subsubtree", "copy of fileInSubSubTree.txt should contain the same content as the source file");

  file.removeTree(srcFiles[5]);
  file.removeTree(tgtFiles[5]);
}


exports.testRename = function(test) {
  let filename = file.join(profilePath, 'open.txt');
  let filename2 = file.join(profilePath, 'open2.txt');

  file.write(filename, "Hello testRename");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.write");

  file.rename(filename, 'open2.txt');

  test.assert(!file.exists(filename),
              "file.exists() should return false for old file after file.rename");

  test.assert(file.exists(filename2),
              "file.exists() should return true for new file after file.rename");
  
  let content = file.read(filename2);
  test.assertEqual(content, "Hello testRename", "rename: new file should contain the same content as the old file");

  file.remove(filename2);
}

exports.testMove = function(test) {
  let filename = file.join(profilePath, 'open.txt');
  let filename2 = file.join(profilePath, 'open2.txt');

  file.write(filename, "Hello testMove");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.write");

  file.move(filename, filename2);

  test.assert(!file.exists(filename),
              "file.exists() should return false for old file after file.move");

  test.assert(file.exists(filename2),
              "file.exists() should return true for new file after file.move");
  
  let content = file.read(filename2);
  test.assertEqual(content, "Hello testMove", "move: new file should contain the same content as the old file");

  file.remove(filename2);
}


exports.testTouch = function(test) {
  let filename = file.join(profilePath, 'open.txt');
  let filename2 = file.join(profilePath, 'open2.txt');

  file.write(filename, "Hello testTouch");

  test.assert(file.exists(filename),
              "file.exists() should return true after file.write");

  file.touch(filename);

  file.touch(filename2);

  test.assert(file.exists(filename2),
              "file.exists() should return true for new file after file.touch");

  let content = file.read(filename2);
  test.assertEqual(content, "", "touch: new file should have no content");
  file.remove(filename);
  file.remove(filename2);
}

exports.testAbsolute = function(test) {
  let currDir = file.workingDirectory();
  let dir = profilePath;
  let path = file.join(dir, "test-dir");
  file.mkpath(path);
  let path2 = file.join(path, 'subdir')
  file.mkpath(path2);

  file.changeWorkingDirectory(path2);

  test.assertEqual(file.absolute('../hello.txt'),
              file.join(path, 'hello.txt'),
              "file.absolute support relative path");
  test.assertEqual(file.absolute(path2+'/../hello.txt'),
              file.join(path, 'hello.txt'),
              "file.absolute support path containing '..'");

  file.changeWorkingDirectory(currDir);
}