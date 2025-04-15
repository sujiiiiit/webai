import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { diffLines, type Change } from 'diff';
import { ActionRunner } from '~/lib/runtime/action-runner';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import type { FileHistory } from '~/types/actions';
import { DiffView } from './DiffView';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';
import { PushToGitHubDialog } from '~/components/@settings/tabs/connections/components/PushToGitHubDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { HeaderActionButtons } from '../header/HeaderActionButtons.client';
import { Button } from '../ui/Button';
import { CrossIcon, DotMenuIcon, DownloadIcon, FileIcon, GitHubIcon, SyncIcon, TerminalIcon } from '../ui/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover2";
import { Input } from '../ui/input2';
interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  actionRunner: ActionRunner;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  middle: {
    value: 'diff',
    text: 'Diff',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

const FileModifiedDropdown = memo(
  ({
    fileHistory,
    onSelectFile,
  }: {
    fileHistory: Record<string, FileHistory>;
    onSelectFile: (filePath: string) => void;
  }) => {
    const modifiedFiles = Object.entries(fileHistory);
    const hasChanges = modifiedFiles.length > 0;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
      return modifiedFiles.filter(([filePath]) => filePath.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [modifiedFiles, searchQuery]);

    return (
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            
              <Button variant={'outline'} size={'sm'}>
                <span className="font-medium">File Changes</span>
                {hasChanges && (
                  <span>
                    {modifiedFiles.length}
                  </span>
                )}
              </Button>
            
          </PopoverTrigger>

          <PopoverContent align="center" alignOffset={-10}>
                <Input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  className=""
                  onChange={(e) => setSearchQuery(e.target.value)}
                  
                />
                
              <div className="max-h-60 overflow-y-auto">
                {filteredFiles.length > 0 ? (
                  filteredFiles.map(([filePath, history]) => {
                    const extension = filePath.split(".").pop() || "";
                    const language = getLanguageFromExtension(extension);

                    return (
                      <button
                        key={filePath}
                        onClick={() => onSelectFile(filePath)}
                        className="w-full px-3 py-2 text-left rounded-md hover:bg-webai-elements-background-depth-1 transition-colors group bg-transparent"
                      >
                        <div className="flex items-center gap-2">
                            <div className="shrink-0 w-5 h-5 text-color-secondary">
                              <FileIcon size={16}/>
                            </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-sm font-medium text-color-primary">
                                  {filePath.split("/").pop()}
                                </span>
                                <span className="truncate text-xs text-webai-elements-textTertiary">
                                  {filePath}
                                </span>
                              </div>
                              {(() => {
                                // Calculate diff stats
                                const { additions, deletions } = (() => {
                                  if (!history.originalContent) {
                                    return { additions: 0, deletions: 0 };
                                  }

                                  const normalizedOriginal =
                                    history.originalContent.replace(
                                      /\r\n/g,
                                      "\n"
                                    );
                                  const normalizedCurrent =
                                    history.versions[
                                      history.versions.length - 1
                                    ]?.content.replace(/\r\n/g, "\n") || "";

                                  if (
                                    normalizedOriginal === normalizedCurrent
                                  ) {
                                    return { additions: 0, deletions: 0 };
                                  }

                                  const changes = diffLines(
                                    normalizedOriginal,
                                    normalizedCurrent,
                                    {
                                      newlineIsToken: false,
                                      ignoreWhitespace: true,
                                      ignoreCase: false,
                                    }
                                  );

                                  return changes.reduce(
                                    (
                                      acc: {
                                        additions: number;
                                        deletions: number;
                                      },
                                      change: Change
                                    ) => {
                                      if (change.added) {
                                        acc.additions +=
                                          change.value.split("\n").length;
                                      }

                                      if (change.removed) {
                                        acc.deletions +=
                                          change.value.split("\n").length;
                                      }

                                      return acc;
                                    },
                                    { additions: 0, deletions: 0 }
                                  );
                                })();

                                const showStats =
                                  additions > 0 || deletions > 0;

                                return (
                                  showStats && (
                                    <div className="flex items-center gap-1 text-xs shrink-0">
                                      {additions > 0 && (
                                        <span className="text-green-500">
                                          +{additions}
                                        </span>
                                      )}
                                      {deletions > 0 && (
                                        <span className="text-red-500">
                                          -{deletions}
                                        </span>
                                      )}
                                    </div>
                                  )
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-12 h-12 mb-2 text-webai-elements-textTertiary">
                      <FileIcon size={32} className="text-color-secondary" />
                    </div>
                    <p className="text-sm font-medium text-color-primary">
                      {searchQuery ? "No matching files" : "No modified files"}
                    </p>
                    <p className="text-xs text-webai-elements-textTertiary mt-1">
                      {searchQuery
                        ? "Try another search"
                        : "Changes will appear here as you edit"}
                    </p>
                  </div>
                )}
              </div>

            {hasChanges && (
              <div className="border-t border-light p-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      filteredFiles.map(([filePath]) => filePath).join("\n")
                    );
                    toast.success("File list copied to clipboard");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-webai-elements-background-depth-1 hover:bg-webai-elements-background-depth-3 transition-colors text-webai-elements-textTertiary hover:text-color-primary"
                >
                  Copy File List
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);

export const Workbench = memo(
  ({ chatStarted, isStreaming, actionRunner, metadata, updateChatMestaData }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    // const modifiedFiles = Array.from(useStore(workbenchStore.unsavedFiles).keys());

    const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const selectedView = useStore(workbenchStore.currentView);

    const isSmallViewport = useViewport(1024);

    const setSelectedView = (view: WorkbenchViewType) => {
      workbenchStore.currentView.set(view);
    };

    useEffect(() => {
      if (hasPreview) {
        setSelectedView('preview');
      }
    }, [hasPreview]);

    useEffect(() => {
      workbenchStore.setDocuments(files);
    }, [files]);

    const onEditorChange = useCallback<OnEditorChange>((update) => {
      workbenchStore.setCurrentDocumentContent(update.content);
    }, []);

    const onEditorScroll = useCallback<OnEditorScroll>((position) => {
      workbenchStore.setCurrentDocumentScrollPosition(position);
    }, []);

    const onFileSelect = useCallback((filePath: string | undefined) => {
      workbenchStore.setSelectedFile(filePath);
    }, []);

    const onFileSave = useCallback(() => {
      workbenchStore.saveCurrentDocument().catch(() => {
        toast.error('Failed to update file content');
      });
    }, []);

    const onFileReset = useCallback(() => {
      workbenchStore.resetCurrentDocument();
    }, []);

    const handleSyncFiles = useCallback(async () => {
      setIsSyncing(true);

      try {
        const directoryHandle = await window.showDirectoryPicker();
        await workbenchStore.syncFiles(directoryHandle);
        toast.success('Files synced successfully');
      } catch (error) {
        console.error('Error syncing files:', error);
        toast.error('Failed to sync files');
      } finally {
        setIsSyncing(false);
      }
    }, []);

    const handleSelectFile = useCallback((filePath: string) => {
      workbenchStore.setSelectedFile(filePath);
      workbenchStore.currentView.set('diff');
    }, []);

    return (
      chatStarted && (
        <motion.div
          initial="closed"
          animate={showWorkbench ? 'open' : 'closed'}
          variants={workbenchVariants}
          className="z-[4]"
        >
          <div
            className={classNames(
              'fixed top-0 bottom-0 right-0 w-[var(--workbench-inner-width)] z-[4] transition-[left,width] duration-200 webai-ease-cubic-bezier',
              {
                'w-full': isSmallViewport,
                'left-0': showWorkbench && isSmallViewport,
                'left-[var(--workbench-left)]': showWorkbench,
                'left-[100%]': !showWorkbench,
              },
            )}
          >
            <div className={`absolute inset-0 `}>
              <div className="h-full flex flex-col bg-vs border-l border-light shadow-lg overflow-hidden">
                <div className="flex items-center px-3 h-12 border-b border-light gap-1.5">
                  <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                  <div className="ml-auto" />
                  {selectedView === "code" && (
                    <>
                      <div className="flex items-center gap-1">
                        <HeaderActionButtons />

                        <Button
                          size={"smicon"}
                          variant={"outline"}
                          onClick={() => {
                            workbenchStore.toggleTerminal(
                              !workbenchStore.showTerminal.get()
                            );
                          }}
                        >
                          <TerminalIcon className="text-color-secondary" size={20} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant={"outline"} size={"smicon"}>
                              <DotMenuIcon className="text-color-secondary" size={20} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" alignOffset={-100}>
                            <DropdownMenuItem
                              onClick={() => {
                                workbenchStore.downloadZip();
                              }}
                            >
                              <DownloadIcon
                                size={20}
                                className="text-color-secondary"
                              />
                              Download Files
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={handleSyncFiles}
                              disabled={isSyncing}
                            >
                              <SyncIcon
                                size={20}
                                className="text-color-secondary"
                              />
                              {isSyncing ? "Syncing..." : "Sync Files"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setIsPushDialogOpen(true)}
                            >
                              <GitHubIcon
                                size={20}
                                className="text-color-secondary"
                              />
                              Push to GitHub
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                      {selectedView === "diff" && (
                    <FileModifiedDropdown
                      fileHistory={fileHistory}
                      onSelectFile={handleSelectFile}
                    />
                  )}
                  <Button
                    size="smicon"
                    onClick={() => {
                      workbenchStore.showWorkbench.set(false);
                    }}
                    variant={'outline'}
                  >
                    <CrossIcon className="text-color-secondary" size={20} />
                  </Button>
                </div>
                <div className="relative flex-1 overflow-hidden">
                  <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
                    <EditorPanel
                      editorDocument={currentDocument}
                      isStreaming={isStreaming}
                      selectedFile={selectedFile}
                      files={files}
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      onFileSelect={onFileSelect}
                      onEditorScroll={onEditorScroll}
                      onEditorChange={onEditorChange}
                      onFileSave={onFileSave}
                      onFileReset={onFileReset}
                    />
                  </View>
                  <View
                    initial={{ x: '100%' }}
                    animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
                  >
                    <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} actionRunner={actionRunner} />
                  </View>
                  <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
                    <Preview />
                  </View>
                </div>
              </div>
            </div>
          </div>
          <PushToGitHubDialog
            isOpen={isPushDialogOpen}
            onClose={() => setIsPushDialogOpen(false)}
            onPush={async (repoName, username, token) => {
              try {
                const commitMessage = prompt('Please enter a commit message:', 'Initial commit') || 'Initial commit';
                await workbenchStore.pushToGitHub(repoName, commitMessage, username, token);

                const repoUrl = `https://github.com/${username}/${repoName}`;

                if (updateChatMestaData && !metadata?.gitUrl) {
                  updateChatMestaData({
                    ...(metadata || {}),
                    gitUrl: repoUrl,
                  });
                }

                return repoUrl;
              } catch (error) {
                console.error('Error pushing to GitHub:', error);
                toast.error('Failed to push to GitHub');
                throw error;
              }
            }}
          />
        </motion.div>
      )
    );
  },
);

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
