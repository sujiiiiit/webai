import { Button } from '../ui/Button';
import { SendIcon, SquareIcon } from '../ui/icons';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

export const SendButton = ({ show, isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <Button
      className="rounded-full text-color-secondary hover:bg-accent w-9 h-9 flex items-center justify-center bg-black dark:bg-white"
      disabled={!show}
      size={'icon'}
      onClick={(event) => {
        event.preventDefault();

        if (!disabled) {
          onClick?.(event);
        }
      }}
    >
      {!isStreaming ? (
        <SendIcon className="text-white dark:text-black" />
      ) : (
        <SquareIcon size={18} className="text-black dark:text-white" />
      )}
    </Button>
  );
};
