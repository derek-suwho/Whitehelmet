import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { useSourcesStore } from '@/stores/sources'

function mockFileList(files: File[]): FileList {
  const list = files as unknown as FileList
  Object.defineProperty(list, 'length', { value: files.length, writable: false })
  Object.defineProperty(list, Symbol.iterator, {
    value: files[Symbol.iterator].bind(files),
  })
  // FileList needs numeric indexing
  files.forEach((f, i) => {
    Object.defineProperty(list, i, { value: f, enumerable: true })
  })
  return list
}

function makeFile(name: string, size = 100, webkitRelativePath?: string): File {
  const f = new File(['x'.repeat(size)], name, { type: 'application/octet-stream' })
  if (webkitRelativePath) {
    Object.defineProperty(f, 'webkitRelativePath', { value: webkitRelativePath })
  }
  return f
}

describe('sources store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addFiles adds sources', () => {
    const store = useSourcesStore()
    const files = mockFileList([makeFile('a.xlsx'), makeFile('b.xlsx')])
    store.addFiles(files)
    expect(store.sources).toHaveLength(2)
    expect(store.sources[0].name).toBe('a.xlsx')
    expect(store.sources[1].name).toBe('b.xlsx')
    expect(store.sources[0].type).toBe('file')
  })

  it('addFolder creates folder with children', () => {
    const store = useSourcesStore()
    const files = mockFileList([
      makeFile('f1.xlsx', 50, 'MyFolder/f1.xlsx'),
      makeFile('f2.xlsx', 60, 'MyFolder/f2.xlsx'),
    ])
    store.addFolder(files)
    expect(store.sources).toHaveLength(1)
    expect(store.sources[0].type).toBe('folder')
    expect(store.sources[0].name).toBe('MyFolder')
    expect(store.sources[0].children).toHaveLength(2)
    expect(store.sources[0].size).toBe(110)
  })

  it('addFolder with empty FileList does nothing', () => {
    const store = useSourcesStore()
    const files = mockFileList([])
    store.addFolder(files)
    expect(store.sources).toHaveLength(0)
  })

  it('removeSource removes by id', () => {
    const store = useSourcesStore()
    store.addFiles(mockFileList([makeFile('a.xlsx')]))
    const id = store.sources[0].id
    store.removeSource(id)
    expect(store.sources).toHaveLength(0)
  })

  it('removeSource removes folder and unchecks children', () => {
    const store = useSourcesStore()
    store.addFolder(
      mockFileList([
        makeFile('f1.xlsx', 50, 'Folder/f1.xlsx'),
        makeFile('f2.xlsx', 60, 'Folder/f2.xlsx'),
      ]),
    )
    const folder = store.sources[0]
    // Check folder (checks children too)
    store.toggleCheck(folder.id)
    expect(store.checkedIds.size).toBe(3) // folder + 2 children

    store.removeSource(folder.id)
    expect(store.sources).toHaveLength(0)
    expect(store.checkedIds.size).toBe(0)
  })

  it('toggleCheck file adds to checkedIds', () => {
    const store = useSourcesStore()
    store.addFiles(mockFileList([makeFile('a.xlsx')]))
    const id = store.sources[0].id
    store.toggleCheck(id)
    expect(store.checkedIds.has(id)).toBe(true)
  })

  it('toggleCheck folder checks all children', () => {
    const store = useSourcesStore()
    store.addFolder(
      mockFileList([
        makeFile('f1.xlsx', 50, 'Folder/f1.xlsx'),
        makeFile('f2.xlsx', 60, 'Folder/f2.xlsx'),
      ]),
    )
    const folder = store.sources[0]
    store.toggleCheck(folder.id)

    expect(store.checkedIds.has(folder.id)).toBe(true)
    for (const child of folder.children!) {
      expect(store.checkedIds.has(child.id)).toBe(true)
    }
  })

  it('toggleCheck again unchecks', () => {
    const store = useSourcesStore()
    store.addFiles(mockFileList([makeFile('a.xlsx')]))
    const id = store.sources[0].id
    store.toggleCheck(id)
    expect(store.checkedIds.has(id)).toBe(true)
    store.toggleCheck(id)
    expect(store.checkedIds.has(id)).toBe(false)
  })

  it('getCheckedFiles returns correct File objects', () => {
    const store = useSourcesStore()
    const file1 = makeFile('a.xlsx')
    const file2 = makeFile('b.xlsx')
    store.addFiles(mockFileList([file1, file2]))

    store.toggleCheck(store.sources[0].id)
    const checked = store.getCheckedFiles()
    expect(checked).toHaveLength(1)
    expect(checked[0].name).toBe('a.xlsx')
  })

  it('getCheckedFiles includes checked folder children', () => {
    const store = useSourcesStore()
    store.addFolder(
      mockFileList([
        makeFile('f1.xlsx', 50, 'Folder/f1.xlsx'),
        makeFile('f2.xlsx', 60, 'Folder/f2.xlsx'),
      ]),
    )
    store.toggleCheck(store.sources[0].id)
    const checked = store.getCheckedFiles()
    expect(checked).toHaveLength(2)
  })

  it('checkedCount computed is reactive', () => {
    const store = useSourcesStore()
    expect(store.checkedCount).toBe(0)
    store.addFiles(mockFileList([makeFile('a.xlsx')]))
    store.toggleCheck(store.sources[0].id)
    expect(store.checkedCount).toBe(1)
  })

  it('removeSource with non-existent id does nothing', () => {
    const store = useSourcesStore()
    store.addFiles(mockFileList([makeFile('a.xlsx')]))
    store.removeSource('does-not-exist')
    expect(store.sources).toHaveLength(1)
  })
})
