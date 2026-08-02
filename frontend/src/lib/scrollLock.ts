/**
 * Reference-counted body scroll lock.
 *
 * Every full-screen layer in the app — modals, the image viewer, the admin
 * sheet, the chat surfaces — parks the page behind it with
 * `body.overflow = "hidden"`. Each used to keep its own snapshot of the
 * previous inline style and write it back on cleanup, which is only correct
 * when locks release in the exact reverse order they were taken. React does
 * not promise that: when a page unmounts with a modal still open (leaving an
 * event chat via its confirm dialog, a partner ending the chat under an open
 * dialog), the page's cleanup can run before the modal's, and the modal then
 * "restores" the `hidden` it snapshotted from the page's own lock. The body
 * stays unscrollable on whatever screen comes next until a hard refresh.
 *
 * A shared counter makes release order irrelevant: the true pre-lock style is
 * saved once, when the count rises from zero, and written back exactly once,
 * when it falls back to zero.
 *
 * The scrollbar's width is given back as padding for the duration of the
 * lock, so removing it never shifts the layout behind the layer. Measured at
 * first lock — the only moment the document scrollbar still exists.
 */

let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

/** Lock body scrolling; returns a release function (safe to call once). */
export function lockBodyScroll(): () => void {
  if (locks === 0) {
    const { body } = document;
    saved = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  }
  locks += 1;

  let released = false;
  return () => {
    // Idempotent per caller: a double release must not steal another
    // layer's still-held lock.
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0 && saved) {
      document.body.style.overflow = saved.overflow;
      document.body.style.paddingRight = saved.paddingRight;
      saved = null;
    }
  };
}
