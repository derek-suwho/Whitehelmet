import { state } from './state.js';

export function initFileIngestion() {
  // Data model: sources[] contains { type:'file', ... } and { type:'folder', name, files:[], expanded }
  var sources = [];
  var fileInput     = document.getElementById('file-input');
  var folderInput   = document.getElementById('folder-input');
  var panelLeft     = document.querySelector('.panel-left');
  var panelBody     = panelLeft.querySelector('.panel-body');
  var badge         = panelLeft.querySelector('.panel-header-badge');
  var selectedItemEl = null;

  // ── Empty state HTML template ──────────────────────────
  var emptyStateHTML = panelBody.innerHTML;

  // ── SVG constants ──────────────────────────────────────
  var FILE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  var FOLDER_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var CHEVRON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var DELETE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var PLUS_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  // ── Helpers ───────────────────────────────────────────
  function formatFileSize(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function truncateName(name, max) {
    if (name.length <= max) return name;
    var ext = name.lastIndexOf('.');
    var base = ext > 0 ? name.slice(0, ext) : name;
    var suffix = ext > 0 ? name.slice(ext) : '';
    return base.slice(0, max - 3 - suffix.length) + '\u2026' + suffix;
  }

  function getTotalFileCount() {
    var count = 0;
    sources.forEach(function (s) {
      if (s.type === 'file') count++;
      else if (s.type === 'folder') count += s.files.length;
    });
    return count;
  }

  // ── Add individual files (deduped) ─────────────────────
  function addFiles(fileList) {
    var added = false;
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (!f.name.toLowerCase().endsWith('.xlsx')) continue;
      // Check dups across top-level files
      var dup = false;
      for (var j = 0; j < sources.length; j++) {
        if (sources[j].type === 'file' && sources[j].name === f.name) { dup = true; break; }
      }
      if (dup) continue;
      sources.push({ type: 'file', name: f.name, size: f.size, lastModified: f.lastModified, file: f });
      added = true;
    }
    if (added) render();
  }

  // ── Add a folder (with its xlsx files grouped) ─────────
  function addFolder(folderName, fileList) {
    // Check if folder name already exists
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].type === 'folder' && sources[i].name === folderName) return;
    }
    var xlsxFiles = [];
    for (var j = 0; j < fileList.length; j++) {
      var f = fileList[j];
      if (f.name.toLowerCase().endsWith('.xlsx')) {
        xlsxFiles.push({ name: f.name, size: f.size, lastModified: f.lastModified, file: f });
      }
    }
    if (xlsxFiles.length === 0) return;
    sources.push({ type: 'folder', name: folderName, files: xlsxFiles, expanded: false });
    render();
  }

  // ── Delete source ─────────────────────────────────────
  function deleteSource(index) {
    var removed = sources[index];
    // Close center panel if the removed source is currently open
    if (state.closeFile && state.excelState && state.excelState.fileName) {
      var openName = state.excelState.fileName;
      if (removed.type === 'file' && removed.file.name === openName) {
        state.closeFile(openName);
      } else if (removed.type === 'folder') {
        for (var i = 0; i < removed.files.length; i++) {
          if (removed.files[i].file.name === openName) {
            state.closeFile(openName);
            break;
          }
        }
      }
    }
    sources.splice(index, 1);
    render();
  }

  // ── Render ────────────────────────────────────────────
  function render() {
    var total = getTotalFileCount();
    badge.textContent = total === 0 ? '0 files' : (total === 1 ? '1 file' : total + ' files');

    if (sources.length === 0) {
      panelBody.innerHTML = emptyStateHTML;
      wireEmptyState();
      return;
    }

    var list = document.createElement('div');
    list.className = 'file-list';

    sources.forEach(function (s, idx) {
      if (s.type === 'file') {
        list.appendChild(createFileItem(s, idx));
      } else if (s.type === 'folder') {
        list.appendChild(createFolderItem(s, idx));
      }
    });

    // Action buttons row
    var actionsRow = document.createElement('div');
    actionsRow.className = 'add-files-row';

    var addBtn = document.createElement('button');
    addBtn.className = 'add-files-btn';
    addBtn.innerHTML = PLUS_ICON + ' Add files';
    addBtn.addEventListener('click', function () { fileInput.click(); });

    var addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'add-files-btn';
    addFolderBtn.innerHTML = FOLDER_ICON + ' Add folder';
    addFolderBtn.addEventListener('click', function () { folderInput.click(); });

    actionsRow.appendChild(addBtn);
    actionsRow.appendChild(addFolderBtn);
    list.appendChild(actionsRow);

    panelBody.innerHTML = '';
    panelBody.appendChild(list);
  }

  function selectItem(el) {
    if (selectedItemEl) selectedItemEl.classList.remove('source-selected');
    selectedItemEl = el;
    if (el) el.classList.add('source-selected');
  }

  function createFileItem(f, sourceIdx) {
    var item = document.createElement('div');
    item.className = 'source-item';
    item.style.cursor = 'pointer';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'source-check';
    cb.title = 'Select for consolidation';
    cb._fileRef = f.file;
    cb.addEventListener('click', function (e) { e.stopPropagation(); });

    var icon = document.createElement('div');
    icon.className = 'source-item-icon icon-file';
    icon.innerHTML = FILE_ICON;

    var info = document.createElement('div');
    info.className = 'source-item-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'source-item-name';
    nameEl.title = f.name;
    nameEl.textContent = truncateName(f.name, 28);

    var metaEl = document.createElement('div');
    metaEl.className = 'source-item-meta';
    metaEl.textContent = formatFileSize(f.size) + ' \u00b7 ' + formatDate(f.lastModified);

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    var delBtn = document.createElement('button');
    delBtn.className = 'source-item-delete';
    delBtn.innerHTML = DELETE_ICON;
    delBtn.title = 'Remove file';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteSource(sourceIdx);
    });

    item.addEventListener('click', function () {
      selectItem(item);
      if (state.openFile) state.openFile(f.file);
    });

    item.appendChild(cb);
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(delBtn);
    return item;
  }

  function createFolderItem(folder, sourceIdx) {
    var wrapper = document.createElement('div');

    // Folder header row
    var item = document.createElement('div');
    item.className = 'source-item source-folder-item' + (folder.expanded ? ' expanded' : '');

    var chevron = document.createElement('div');
    chevron.className = 'source-folder-chevron';
    chevron.innerHTML = CHEVRON_ICON;

    var icon = document.createElement('div');
    icon.className = 'source-item-icon icon-folder';
    icon.innerHTML = FOLDER_ICON;

    var info = document.createElement('div');
    info.className = 'source-item-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'source-item-name';
    nameEl.title = folder.name;
    nameEl.textContent = truncateName(folder.name, 22);

    var metaEl = document.createElement('div');
    metaEl.className = 'source-item-meta';
    metaEl.textContent = folder.files.length + ' file' + (folder.files.length !== 1 ? 's' : '');

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    var delBtn = document.createElement('button');
    delBtn.className = 'source-item-delete';
    delBtn.innerHTML = DELETE_ICON;
    delBtn.title = 'Remove folder';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteSource(sourceIdx);
    });

    item.appendChild(chevron);
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(delBtn);

    // Children container
    var children = document.createElement('div');
    children.className = 'source-folder-children' + (folder.expanded ? ' visible' : '');

    folder.files.forEach(function (f) {
      var child = document.createElement('div');
      child.className = 'source-item';
      child.style.cursor = 'pointer';

      var cCb = document.createElement('input');
      cCb.type = 'checkbox';
      cCb.className = 'source-check';
      cCb.title = 'Select for consolidation';
      cCb._fileRef = f.file;
      cCb.addEventListener('click', function (e) { e.stopPropagation(); });

      var cIcon = document.createElement('div');
      cIcon.className = 'source-item-icon icon-file';
      cIcon.innerHTML = FILE_ICON;

      var cInfo = document.createElement('div');
      cInfo.className = 'source-item-info';

      var cName = document.createElement('div');
      cName.className = 'source-item-name';
      cName.title = f.name;
      cName.textContent = truncateName(f.name, 24);

      var cMeta = document.createElement('div');
      cMeta.className = 'source-item-meta';
      cMeta.textContent = formatFileSize(f.size) + ' \u00b7 ' + formatDate(f.lastModified);

      cInfo.appendChild(cName);
      cInfo.appendChild(cMeta);
      child.appendChild(cCb);
      child.appendChild(cIcon);
      child.appendChild(cInfo);

      var cDel = document.createElement('button');
      cDel.className = 'source-item-delete';
      cDel.innerHTML = DELETE_ICON;
      cDel.title = 'Remove file';
      cDel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (state.closeFile && state.excelState && state.excelState.fileName) {
          if (f.file.name === state.excelState.fileName) {
            state.closeFile(f.file.name);
          }
        }
        var fi = folder.files.indexOf(f);
        if (fi !== -1) folder.files.splice(fi, 1);
        if (folder.files.length === 0) sources.splice(sourceIdx, 1);
        render();
      });
      child.appendChild(cDel);

      // Click to open file
      child.addEventListener('click', function (e) {
        e.stopPropagation(); // Prevent folder expand toggle
        selectItem(child);
        if (state.openFile) state.openFile(f.file);
      });

      children.appendChild(child);
    });

    // Toggle expand on click
    item.addEventListener('click', function () {
      folder.expanded = !folder.expanded;
      item.classList.toggle('expanded');
      children.classList.toggle('visible');
    });

    wrapper.appendChild(item);
    wrapper.appendChild(children);
    return wrapper;
  }

  // ── Drag-active visual feedback ───────────────────────
  function setDragActive(on) {
    var dz = panelLeft.querySelector('.drop-zone');
    if (!dz) return;
    if (on) dz.classList.add('drag-active');
    else    dz.classList.remove('drag-active');
  }

  // ── Wire empty state buttons ──────────────────────────
  function wireEmptyState() {
    var dz = panelLeft.querySelector('.drop-zone');
    if (dz) {
      dz.addEventListener('click', function () { fileInput.click(); });
    }
    var addFilesBtn = document.getElementById('empty-add-files');
    var addFolderBtn = document.getElementById('empty-add-folder');
    if (addFilesBtn) addFilesBtn.addEventListener('click', function () { fileInput.click(); });
    if (addFolderBtn) addFolderBtn.addEventListener('click', function () { folderInput.click(); });
  }

  // Panel-level drag handling
  panelLeft.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
    panelLeft.classList.add('panel-drag-over');
  });

  panelLeft.addEventListener('dragleave', function (e) {
    if (!panelLeft.contains(e.relatedTarget)) {
      setDragActive(false);
      panelLeft.classList.remove('panel-drag-over');
    }
  });

  // ── Folder traversal via FileSystem API ───────────────
  function traverseDirectory(dirEntry) {
    return new Promise(function (resolve) {
      var reader = dirEntry.createReader();
      var allFiles = [];

      function readBatch() {
        reader.readEntries(function (entries) {
          if (entries.length === 0) {
            resolve(allFiles);
            return;
          }
          var pending = entries.length;
          entries.forEach(function (entry) {
            if (entry.isFile) {
              entry.file(function (file) {
                allFiles.push(file);
                if (--pending === 0) readBatch();
              }, function () {
                if (--pending === 0) readBatch();
              });
            } else if (entry.isDirectory) {
              traverseDirectory(entry).then(function (subFiles) {
                allFiles = allFiles.concat(subFiles);
                if (--pending === 0) readBatch();
              });
            } else {
              if (--pending === 0) readBatch();
            }
          });
        }, function () {
          resolve(allFiles);
        });
      }

      readBatch();
    });
  }

  panelLeft.addEventListener('drop', function (e) {
    e.preventDefault();
    setDragActive(false);
    panelLeft.classList.remove('panel-drag-over');

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0 &&
        typeof e.dataTransfer.items[0].webkitGetAsEntry === 'function') {
      var items = Array.from(e.dataTransfer.items);
      var folderPromises = [];
      var looseFiles = [];

      items.forEach(function (item) {
        var entry = item.webkitGetAsEntry();
        if (!entry) return;
        if (entry.isDirectory) {
          var folderName = entry.name;
          folderPromises.push(
            traverseDirectory(entry).then(function (files) {
              addFolder(folderName, files);
            })
          );
        } else {
          // Loose file
          folderPromises.push(
            new Promise(function (resolve) {
              entry.file(function (file) { looseFiles.push(file); resolve(); }, resolve);
            })
          );
        }
      });

      Promise.all(folderPromises).then(function () {
        if (looseFiles.length > 0) addFiles(looseFiles);
      });
    } else {
      addFiles(e.dataTransfer.files);
    }
  });

  // File input change
  fileInput.addEventListener('change', function () {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  // Folder input change — group by folder name
  folderInput.addEventListener('change', function () {
    var files = folderInput.files;
    if (files.length === 0) { folderInput.value = ''; return; }
    // Extract folder name from webkitRelativePath
    var folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Uploaded Folder';
    addFolder(folderName, files);
    folderInput.value = '';
  });

  // Initial wire
  wireEmptyState();
}
