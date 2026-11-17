/**
 * One shared Save/Discard question for editor and Explorer close actions.
 * Esc closes the question without changing any documents.
 * Returned choices: true=save, false=discard, null=leave open.
 */
let priorDialog = Promise.resolve();

export function askSaveBeforeClose(doc, title, description, labels) {
  const run = () => new Promise(resolve => {
    const dialog = doc.createElement("dialog");
    dialog.className = "save-close-dialog";
    dialog.setAttribute("aria-modal", "true");
    const heading = doc.createElement("h2");
    heading.textContent = title;
    heading.id = "saveCloseTitle";
    dialog.setAttribute("aria-labelledby", heading.id);
    const message = doc.createElement("p");
    message.textContent = description;
    const actions = doc.createElement("div");
    actions.className = "save-close-actions";
    const button = (label, choice, className) => {
      const control = doc.createElement("button");
      control.type = "button";
      control.textContent = label;
      control.className = className;
      control.addEventListener("click", () => {
        finish(choice);
      });
      return control;
    };
    let finished = false;
    function finish(choice) {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(choice);
    }
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    actions.append(
      button(labels.no, false, "save-close-no"),
      button(labels.yes, true, "save-close-yes")
    );
    dialog.append(heading, message, actions);
    doc.body.append(dialog);
    dialog.showModal();
  });
  const result = priorDialog.then(run);
  priorDialog = result.then(() => {}, () => {});
  return result;
}
