/**
 * Browser-facing read-only API Catalog.
 *
 * The browser is always the registered UI caller. Never accept a source
 * or an origin from webpage code: doing so would allow impersonation.
 * All reads pass through HubUnit authorization and OMU audit.
 */
export function createClusterAPIFacade(core) {
  const discover = (command, kind, selector = {}, page = {}) => {
    const options = { ...page, origin: "user" };
    return core.discover("ui", command, kind, selector, options);
  };
  return Object.freeze({
    list: (kind, page = {}) => discover("list", kind, page),
    page: (kind, page = {}) => discover("page", kind, page),
    describeLive: (kind, id, owner = null) =>
      discover("describeLive", kind, { id, owner }),
    describe: (kind, id, owner = null) =>
      discover("describe", kind, { id, owner }),
    query: (kind, filter = {}, page = {}) =>
      discover("query", kind, filter, page),
    docs: (format = "json") =>
      core.generateCatalogDocs("ui", format, { origin: "user" })
  });
}
