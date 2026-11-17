/**
 * Browser route metadata facade. Source and origin are trusted constants,
 * never accepted from page-provided arguments. No mutation or dispatch.
 */
export function createRouteReadFacade(core) {
  const read = (command, input) =>
    core.inspectRoutes("ui", command, input, "user");
  return Object.freeze({
    list: (page = {}) => read("list", page),
    describe: routeId => read("describe", routeId),
    preview: (service, action) =>
      read("preview", { service, action })
  });
}
