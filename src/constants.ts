// Global symbols ensuring a single shared registry across microfrontends
export const HANDLED_ERRORS_KEY = Symbol.for(
  "__REACT_MICRO_BOUNDARY_HANDLED_ERRORS__",
);
export const INIT_FLAG_KEY = Symbol.for("__REACT_MICRO_BOUNDARY_INIT_FLAG__");
// Global symbol for storing reference to active listeners
export const LISTENERS_KEY = Symbol.for("__REACT_MICRO_BOUNDARY_LISTENERS__");
