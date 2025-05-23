import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { FileHistory } from '~/types/actions';
import { diffLines, type Change } from 'diff';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { path } from '~/utils/path';
import { FileIcon, RightArrowSmall } from '../ui/icons';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  fileHistory?: Record<string, FileHistory>;
  className?: string;
}

interface InlineInputProps {
  depth: number;
  placeholder: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
    fileHistory = {},
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState(() => {
      return collapsed
        ? new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath))
        : new Set<string>();
    });

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
        return;
      }

      setCollapsedFolders((prevCollapsed) => {
        const newCollapsed = new Set<string>();

        for (const folder of fileList) {
          if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
            newCollapsed.add(folder.fullPath);
          }
        }

        return newCollapsed;
      });
    }, [fileList, collapsed]);

    const filteredFileList = useMemo(() => {
      const list = [];

      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileOrFolder of fileList) {
        const depth = fileOrFolder.depth;

        // if the depth is equal we reached the end of the collaped group
        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        // ignore collapsed folders
        if (collapsedFolders.has(fileOrFolder.fullPath)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        // ignore files and folders below the last collapsed folder
        if (lastDepth < depth) {
          continue;
        }

        list.push(fileOrFolder);
      }

      return list;
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders((prevSet) => {
        const newSet = new Set(prevSet);

        if (newSet.has(fullPath)) {
          newSet.delete(fullPath);
        } else {
          newSet.add(fullPath);
        }

        return newSet;
      });
    };

    const onCopyPath = (fileOrFolder: FileNode | FolderNode) => {
      try {
        navigator.clipboard.writeText(fileOrFolder.fullPath);
      } catch (error) {
        logger.error(error);
      }
    };

    const onCopyRelativePath = (fileOrFolder: FileNode | FolderNode) => {
      try {
        navigator.clipboard.writeText(fileOrFolder.fullPath.substring((rootFolder || '').length));
      } catch (error) {
        logger.error(error);
      }
    };

    return (
      <div className={classNames('text-[13px] p-2 flex flex-col gap-1', className, 'overflow-y-auto')}>
        {filteredFileList.map((fileOrFolder) => {
          switch (fileOrFolder.kind) {
            case 'file': {
              return (
                <File
                  key={fileOrFolder.id}
                  selected={selectedFile === fileOrFolder.fullPath}
                  file={fileOrFolder}
                  unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                  fileHistory={fileHistory}
                  onCopyPath={() => {
                    onCopyPath(fileOrFolder);
                  }}
                  onCopyRelativePath={() => {
                    onCopyRelativePath(fileOrFolder);
                  }}
                  onClick={() => {
                    onFileSelect?.(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileOrFolder.id}
                  folder={fileOrFolder}
                  selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                  collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                  onCopyPath={() => {
                    onCopyPath(fileOrFolder);
                  }}
                  onCopyRelativePath={() => {
                    onCopyRelativePath(fileOrFolder);
                  }}
                  onClick={() => {
                    toggleCollapseState(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            default: {
              return undefined;
            }
          }
        })}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onClick: () => void;
}

interface FolderContextMenuProps {
  onCopyPath?: () => void;
  onCopyRelativePath?: () => void;
  children: ReactNode;
}

function ContextMenuItem({ onSelect, children }: { onSelect?: () => void; children: ReactNode }) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-2 py-1.5 outline-0 text-[13px] text-color-primary cursor-pointer ws-nowrap text-color-secondary hover:text-blue-400 hover:bg-webai-elements-item-backgroundActive rounded-md"
    >
      <span className="size-4 shrink-0"></span>
      <span>{children}</span>
    </ContextMenu.Item>
  );
}

function InlineInput({ depth, placeholder, initialValue = '', onSubmit, onCancel }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();

        if (initialValue) {
          inputRef.current.value = initialValue;
          inputRef.current.select();
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim();

      if (value) {
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center w-full px-2 bg-webai-elements-background-depth-4 border border-webai-elements-item-contentAccent py-0.5 text-color-primary"
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
    >
      <div className="scale-120 shrink-0 i-ph:file-plus text-color-secondary" />
      <input
        ref={inputRef}
        type="text"
        className="ml-2 flex-1 bg-transparent border-none outline-none py-0.5 text-[13px] text-color-primary placeholder:text-color-secondary min-w-0"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== inputRef.current) {
              onCancel();
            }
          }, 100);
        }}
      />
    </div>
  );
}

function FileContextMenu({
  onCopyPath,
  onCopyRelativePath,
  fullPath,
  children,
}: FolderContextMenuProps & { fullPath: string }) {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const depth = useMemo(() => fullPath.split('/').length, [fullPath]);
  const fileName = useMemo(() => path.basename(fullPath), [fullPath]);

  const isFolder = useMemo(() => {
    const files = workbenchStore.files.get();
    const fileEntry = files[fullPath];

    return !fileEntry || fileEntry.type === 'folder';
  }, [fullPath]);

  const targetPath = useMemo(() => {
    return isFolder ? fullPath : path.dirname(fullPath);
  }, [fullPath, isFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items = Array.from(e.dataTransfer.items);
      const files = items.filter((item) => item.kind === 'file');

      for (const item of files) {
        const file = item.getAsFile();

        if (file) {
          try {
            const filePath = path.join(fullPath, file.name);

            // Convert file to binary data (Uint8Array)
            const arrayBuffer = await file.arrayBuffer();
            const binaryContent = new Uint8Array(arrayBuffer);

            const success = await workbenchStore.createFile(filePath, binaryContent);

            if (success) {
              toast.success(`File ${file.name} uploaded successfully`);
            } else {
              toast.error(`Failed to upload file ${file.name}`);
            }
          } catch (error) {
            toast.error(`Error uploading ${file.name}`);
            logger.error(error);
          }
        }
      }

      setIsDragging(false);
    },
    [fullPath],
  );

  const handleCreateFile = async (fileName: string) => {
    const newFilePath = path.join(targetPath, fileName);
    const success = await workbenchStore.createFile(newFilePath, '');

    if (success) {
      toast.success('File created successfully');
    } else {
      toast.error('Failed to create file');
    }

    setIsCreatingFile(false);
  };

  const handleCreateFolder = async (folderName: string) => {
    const newFolderPath = path.join(targetPath, folderName);
    const success = await workbenchStore.createFolder(newFolderPath);

    if (success) {
      toast.success('Folder created successfully');
    } else {
      toast.error('Failed to create folder');
    }

    setIsCreatingFolder(false);
  };

  const handleDelete = async () => {
    try {
      if (!confirm(`Are you sure you want to delete ${isFolder ? 'folder' : 'file'}: ${fileName}?`)) {
        return;
      }

      let success;

      if (isFolder) {
        success = await workbenchStore.deleteFolder(fullPath);
      } else {
        success = await workbenchStore.deleteFile(fullPath);
      }

      if (success) {
        toast.success(`${isFolder ? 'Folder' : 'File'} deleted successfully`);
      } else {
        toast.error(`Failed to delete ${isFolder ? 'folder' : 'file'}`);
      }
    } catch (error) {
      toast.error(`Error deleting ${isFolder ? 'folder' : 'file'}`);
      logger.error(error);
    }
  };

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={classNames('relative', {
              'bg-webai-elements-background-depth-2 border border-dashed border-webai-elements-item-contentAccent rounded-md':
                isDragging,
            })}
          >
            {children}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            style={{ zIndex: 998 }}
            className="border border-light rounded-md z-context-menu bg-webai-elements-background-depth-1 dark:bg-webai-elements-background-depth-2 data-[state=open]:animate-in animate-duration-100 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 w-56"
          >
            <ContextMenu.Group className="p-1 border-b-px border-solid border-light">
              <ContextMenuItem onSelect={() => setIsCreatingFile(true)}>
                <div className="flex items-center gap-2">
                  <div className="i-ph:file-plus" />
                  New File
                </div>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setIsCreatingFolder(true)}>
                <div className="flex items-center gap-2">
                  <div className="i-ph:folder-plus" />
                  New Folder
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>
            <ContextMenu.Group className="p-1">
              <ContextMenuItem onSelect={onCopyPath}>Copy path</ContextMenuItem>
              <ContextMenuItem onSelect={onCopyRelativePath}>Copy relative path</ContextMenuItem>
            </ContextMenu.Group>
            {/* Add delete option in a new group */}
            <ContextMenu.Group className="p-1 border-t-px border-solid border-light">
              <ContextMenuItem onSelect={handleDelete}>
                <div className="flex items-center gap-2 text-red-500">
                  <div className="i-ph:trash" />
                  Delete {isFolder ? 'Folder' : 'File'}
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {isCreatingFile && (
        <InlineInput
          depth={depth}
          placeholder="Enter file name..."
          onSubmit={handleCreateFile}
          onCancel={() => setIsCreatingFile(false)}
        />
      )}
      {isCreatingFolder && (
        <InlineInput
          depth={depth}
          placeholder="Enter folder name..."
          onSubmit={handleCreateFolder}
          onCancel={() => setIsCreatingFolder(false)}
        />
      )}
    </>
  );
}

function Folder({ folder, collapsed, selected = false, onCopyPath, onCopyRelativePath, onClick }: FolderProps) {
  return (
    <FileContextMenu onCopyPath={onCopyPath} onCopyRelativePath={onCopyRelativePath} fullPath={folder.fullPath}>
      <NodeButton
        className={classNames('group', {
          'bg-transparent text-color-secondary hover:text-blue-400 hover:bg-webai-elements-item-backgroundActive':
            !selected,
          'bg-blue-500/40 text-blue-500 dark:text-[#48AAFF]': selected,
        })}
        depth={folder.depth}
        iconClasses={<RightArrowSmall size={18} className={`transition-all duration-200 layer-transition shrink-0 ${!collapsed?'rotate-90':''}`}/>}
        onClick={onClick}
      >
        {folder.name}
      </NodeButton>
    </FileContextMenu>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onClick: () => void;
}

function File({
  file,
  onClick,
  onCopyPath,
  onCopyRelativePath,
  selected,
  unsavedChanges = false,
  fileHistory = {},
}: FileProps) {
  const { depth, name, fullPath } = file;

  const fileModifications = fileHistory[fullPath];

  const { additions, deletions } = useMemo(() => {
    if (!fileModifications?.originalContent) {
      return { additions: 0, deletions: 0 };
    }

    const normalizedOriginal = fileModifications.originalContent.replace(/\r\n/g, '\n');
    const normalizedCurrent =
      fileModifications.versions[fileModifications.versions.length - 1]?.content.replace(/\r\n/g, '\n') || '';

    if (normalizedOriginal === normalizedCurrent) {
      return { additions: 0, deletions: 0 };
    }

    const changes = diffLines(normalizedOriginal, normalizedCurrent, {
      newlineIsToken: false,
      ignoreWhitespace: true,
      ignoreCase: false,
    });

    return changes.reduce(
      (acc: { additions: number; deletions: number }, change: Change) => {
        if (change.added) {
          acc.additions += change.value.split('\n').length;
        }

        if (change.removed) {
          acc.deletions += change.value.split('\n').length;
        }

        return acc;
      },
      { additions: 0, deletions: 0 },
    );
  }, [fileModifications]);

  const showStats = additions > 0 || deletions > 0;

  return (
    <FileContextMenu onCopyPath={onCopyPath} onCopyRelativePath={onCopyRelativePath} fullPath={fullPath}>
      <NodeButton
        className={classNames('group', {
          'bg-transparent hover:bg-accent text-color-secondary':
            !selected,
          'bg-blue-500/40 text-blue-500 dark:text-[#48AAFF]': selected,
        })}
        depth={depth}
        iconClasses={<FileIcon size={18}  className='shrink-0' />}
        onClick={onClick}
      >
        <div
          className={classNames('flex items-center', {
            'group-hover:text-blue-400': !selected,
          })}
        >
          <div className="flex-1 truncate pr-2">{name}</div>
          <div className="flex items-center gap-1">
            {showStats && (
              <div className="flex items-center gap-1 text-xs">
                {additions > 0 && <span className="text-green-500">+{additions}</span>}
                {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
              </div>
            )}
            {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
          </div>
        </div>
      </NodeButton>
    </FileContextMenu>
  );
}

interface ButtonProps {
  depth: number;
  iconClasses: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-2 w-full p-2 border-2 border-transparent text-color-secondary rounded-md  h-8',
        className,
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={() => onClick?.()}
    >
      {iconClasses}
      <div className=" flex truncate w-full text-left">{children}</div>
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
