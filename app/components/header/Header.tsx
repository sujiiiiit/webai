import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { Button } from '../ui/Button';
import { CodeIcon, HamBurgerIcon } from '../ui/icons';
import { workbenchStore } from '~/lib/stores/workbench';

export function Header() {
  const chat = useStore(chatStore);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  return (
    <header
      className={classNames('flex items-center px-3 border-b h-[var(--header-height)] z-[3]', {
        'border-transparent': !chat.started,
        'border-light': chat.started,
        'w-full max-w-[var(--chat-max-width)]': showWorkbench,
      })}
    >
      <div className="flex w-full items-center gap-2 z-logo text-color-primary justify-between">
        <div className="flex items-center gap-2">
          <HamBurgerIcon />
          <>
            {chat.started && (
              <>
                <ClientOnly>{() => <ChatDescription />}</ClientOnly>
              </>
            )}
          </>
        </div>
        {chat.started && (
          <>
            <Button
              size={'icon'}
              variant={'outline'}
              className=''
              onClick={() => {
                if (showWorkbench) {
                  chatStore.setKey('showChat', true);
                }

                workbenchStore.showWorkbench.set(!showWorkbench);
              }}
            >
              <CodeIcon size={18} />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
