import { answerDialog, dismissButton, resetDialogs, showDialog, subscribeDialog, type DialogRequest } from './dialogStore';

describe('dialog queue', () => {
  let current: DialogRequest | null = null;
  let unsubscribe: () => void;
  beforeEach(() => {
    resetDialogs();
    unsubscribe = subscribeDialog((request) => (current = request));
  });
  afterEach(() => unsubscribe());

  it('shows a plain message with no buttons of its own (the host adds a translated OK)', () => {
    showDialog('Income', 'All the money you recorded');
    expect(current).toMatchObject({ title: 'Income', message: 'All the money you recorded', buttons: [] });
  });

  it('closes the dialog, then runs the pressed button', () => {
    const order: string[] = [];
    showDialog('Delete?', undefined, [{ text: 'Delete', style: 'destructive', onPress: () => order.push(current === null ? 'closed first' : 'still open') }]);
    answerDialog(current!.id, current!.buttons[0]);
    expect(order).toEqual(['closed first']);
    expect(current).toBeNull();
  });

  it('keeps a second dialog waiting until the first is answered', () => {
    showDialog('First');
    showDialog('Second');
    expect(current?.title).toBe('First');
    answerDialog(current!.id);
    expect(current?.title).toBe('Second');
  });

  it('ignores an answer to a dialog that is no longer on screen', () => {
    showDialog('First');
    const first = current!.id;
    answerDialog(first);
    showDialog('Second');
    answerDialog(first);
    expect(current?.title).toBe('Second');
  });

  it('Back presses Cancel, or the only button; with several and no Cancel it must be answered', () => {
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    expect(dismissButton({ id: 1, title: 't', buttons: [cancel, { text: 'Delete', style: 'destructive' }] })).toBe(cancel);
    const ok = { text: 'OK' };
    expect(dismissButton({ id: 1, title: 't', buttons: [ok] })).toBe(ok);
    expect(dismissButton({ id: 1, title: 't', buttons: [] })).toBeUndefined();
    expect(dismissButton({ id: 1, title: 't', buttons: [{ text: 'A' }, { text: 'B' }] })).toBe(false);
  });
});
