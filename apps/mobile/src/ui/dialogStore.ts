/**
 * The queue behind the app's own dialog (replaces the system Alert, which
 * doesn't follow the Mizan palette). `showDialog` takes the same arguments as
 * `Alert.alert`, so it can be called from anywhere, even outside React; the
 * mounted `DialogHost` draws whatever is at the front of the queue.
 */

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
}

export interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

type Listener = (current: DialogRequest | null) => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  const current = queue[0] ?? null;
  listeners.forEach((listener) => listener(current));
}

/** Shows a dialog; one already on screen stays until it is answered, then this one follows. */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons ?? [] }];
  if (queue.length === 1) emit();
}

/** Closes the dialog on screen, then runs the pressed button's action (if any). */
export function answerDialog(id: number, button?: DialogButton): void {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  emit();
  button?.onPress?.();
}

/**
 * The button that Back or a tap outside presses: the Cancel button, or the
 * only button (none for a plain message, which shows a translated OK). With
 * several buttons and no Cancel, the dialog must be answered.
 */
export function dismissButton(request: DialogRequest): DialogButton | undefined | false {
  const cancel = request.buttons.find((button) => button.style === 'cancel');
  if (cancel) return cancel;
  if (request.buttons.length <= 1) return request.buttons[0];
  return false;
}

export function subscribeDialog(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue[0] ?? null);
  return () => listeners.delete(listener);
}

/** Tests only: forget every queued dialog. */
export function resetDialogs(): void {
  queue = [];
  emit();
}
