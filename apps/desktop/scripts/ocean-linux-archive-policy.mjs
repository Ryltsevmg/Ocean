/** Validate application-root archive metadata without reading or changing any filesystem. */
const PYTHON_BIN = 'resources/runtime/primary-runtime/dependencies/python/bin/'
const PYTHON_ALIASES = new Set([`${PYTHON_BIN}python`, `${PYTHON_BIN}python3`])

function archivePath(value, directory) {
  if (typeof value !== 'string' || !value.isWellFormed()) throw new Error('Invalid archive path')
  const path = directory && value.endsWith('/') ? value.slice(0, -1) : value
  if (path.length === 0 || path.length > 4096 || (/[\\:]/.test(path) || [...path].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
    || path.split('/').some(part => part === '' || part === '.' || part === '..' || Buffer.byteLength(part) > 255)) throw new Error('Invalid archive path')
  return path
}

/** Plan regular entries before the only supported links: bundled Python interpreter aliases.
 * @param {Array<object>} entries Parser-resolved application-root entries with path, type, size and optional linkpath. The parser must reject unsupported headers and must not strip unsafe paths before validation.
 * @param {object} limits Independent positive safe-integer maxEntries (including inferred directories) and maxExpandedBytes limits.
 * @returns {{directories: Array<string>, files: Array<object>, links: Array<object>, expandedBytes: number}} Metadata only, not extraction or installation authorization. An extractor must use a new private staging root and enforce the same byte limits while writing.
 */
export function planLinuxArchive(entries, limits) {
  if (!limits || !Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 1
    || !Number.isSafeInteger(limits.maxExpandedBytes) || limits.maxExpandedBytes < 1) throw new Error('Invalid archive limit')
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > limits.maxEntries) throw new Error('Archive entry limit exceeded')
  const indexed = new Map()
  let expandedBytes = 0
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || !['file', 'directory', 'symlink'].includes(entry.type)) throw new Error('Unsupported archive entry')
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || (entry.type !== 'file' && entry.size !== 0)) throw new Error('Invalid archive entry size')
    if (entry.type !== 'symlink' && entry.linkpath !== undefined) throw new Error('Unexpected archive link target')
    const path = archivePath(entry.path, entry.type === 'directory')
    if (indexed.has(path)) throw new Error('Duplicate archive path')
    if (entry.size > limits.maxExpandedBytes - expandedBytes) throw new Error('Archive expanded-size limit exceeded')
    expandedBytes += entry.size
    indexed.set(path, { path, type: entry.type, size: entry.size, ...(entry.type === 'symlink' ? { linkpath: entry.linkpath } : {}) })
  }
  const plannedPaths = new Set(indexed.keys())
  const directories = new Set()
  const files = []
  const links = []
  for (const entry of indexed.values()) {
    const parts = entry.path.split('/')
    for (let index = 1; index < parts.length; index++) {
      const parent = parts.slice(0, index).join('/')
      if (indexed.has(parent) && indexed.get(parent).type !== 'directory') throw new Error('Non-directory archive ancestor')
      plannedPaths.add(parent)
      if (plannedPaths.size > limits.maxEntries) throw new Error('Archive planned-entry limit exceeded')
      directories.add(parent)
    }
    if (entry.type === 'directory') directories.add(entry.path)
    else if (entry.type === 'file') files.push({ path: entry.path, size: entry.size })
    else {
      if (!PYTHON_ALIASES.has(entry.path) || typeof entry.linkpath !== 'string'
        || !/^python3\.(0|[1-9][0-9]*)$/.test(entry.linkpath)) throw new Error('Unsupported Python alias')
      const target = `${PYTHON_BIN}${entry.linkpath}`
      const interpreter = indexed.get(target)
      if (interpreter?.type !== 'file' || interpreter.size === 0) throw new Error('Python alias requires an included regular interpreter')
      links.push({ path: entry.path, linkpath: entry.linkpath, target })
    }
  }
  if (new Set(links.map(link => link.target)).size > 1) throw new Error('Python aliases must share one interpreter')
  return { directories: [...directories].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)), files, links, expandedBytes }
}
