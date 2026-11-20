/**
 * Human-readable reverse RPC grants for explicit install/upgrade consent.
 * The immutable grant data is validated by PluginRPCScopePolicy.
 */
export function describePluginRPCScopes(scopes, translate) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return translate("無", "None");
  }
  return scopes.map(scope => {
    const property = scope.property === undefined ? "" :
      " [" + scope.property + "]";
    return "- " + scope.target + " / " + scope.action + property;
  }).join("\n");
}
