/**
 * Shared authorization policy. Paths are canonical dot-separated IDs.
 * Protected: object itself and its descendants may invoke the endpoint.
 * Private: the object alone may invoke it.
 */
export const AccessPolicy = Object.freeze({
  PUBLIC: "Public",
  PROTECTED: "Protected",
  PRIVATE: "Private",
  canInvoke(source, target, visibility = "Public") {
    if (visibility === "Public") return true;
    if (visibility === "Private") return source === target;
    if (visibility === "Protected") {
      return source === target || source.startsWith(target + ".");
    }
    return false;
  },
  canUseAction(source, target, action, object) {
    const required = object?.authorization?.[action] ??
      object?.authorization?.default ?? "Public";
    return this.canInvoke(source, target, required);
  }
});
